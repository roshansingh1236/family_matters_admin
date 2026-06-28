import { supabase } from '../lib/supabase';
import type { Match, MatchStatus, User } from '../types';
import { auditService } from './auditService';
import { pushService } from './pushService';

const TABLE_NAME = 'matches';

// The Match Progression checklist items that must all be completed before an
// admin can activate the match (start the journey). `match_declined` is an
// escape hatch and is intentionally excluded.
export const REQUIRED_CHECKLIST_ITEMS = [
  'records_review_complete',
  'match_meeting_complete',
  'match_confirmed',
] as const;

export function isMatchChecklistComplete(match: Pick<Match, 'data'>): boolean {
  const checklist = (match.data?.checklist ?? {}) as Record<string, boolean>;
  if (checklist['match_declined']) return false;
  return REQUIRED_CHECKLIST_ITEMS.every((k) => checklist[k] === true);
}

// Helper to map DB snake_case to Frontend camelCase
const mapMatchFromDb = (dbMatch: any): Match => ({
  id: dbMatch.id,
  intendedParentId: dbMatch.parent_id || dbMatch.intended_parent_id,
  gestationalCarrierId: dbMatch.surrogate_id || dbMatch.gestational_carrier_id,
  createdAt: dbMatch.created_at,
  matchedAt: dbMatch.matched_at,
  status: dbMatch.status,
  matchScore: dbMatch.match_score,
  matchCriteria: dbMatch.match_criteria,
  agencyNotes: dbMatch.agency_notes,
  internalNotes: dbMatch.internal_notes,
  parentAccepted: dbMatch.parent_accepted,
  surrogateAccepted: dbMatch.surrogate_accepted,
  parentDeclined: dbMatch.parent_declined,
  surrogateDeclined: dbMatch.surrogate_declined,
  deliveryDate: dbMatch.delivery_date,
  escrowClosedAt: dbMatch.escrow_closed_at,
  cancellationReason: dbMatch.cancellation_reason,
  coordinatorId: dbMatch.coordinator_id,
  journeyId: dbMatch.journey_id,
  intendedParentData: dbMatch.intendedParentData,
  gestationalCarrierData: dbMatch.gestationalCarrierData,
  // Per client review: progression checklist lives on the JSONB `data` blob —
  // expose it so the Matches page can read selectedMatch.data?.checklist.
  data: dbMatch.data ?? undefined,
});

// ─── Status Transition Guardrails ──────────────────────────────────────────────
// Defines which statuses can transition to which other statuses
const VALID_TRANSITIONS: Record<string, MatchStatus[]> = {
  'Proposed':       ['Presented', 'Cancelled'],
  'Presented':      ['MR Review', 'Accepted', 'Cancelled'],
  'MR Review':      ['Accepted', 'Cancelled'],
  'Accepted':       ['Active', 'Cancelled'],
  'Active':         ['Delivered', 'Cancelled'],
  'Delivered':      ['Escrow Closure', 'Cancelled'],
  'Escrow Closure': ['Completed'],
  'Completed':      [],  // Terminal state
  'Cancelled':      [],  // Terminal state
};

export const matchService = {
  // ─── Fetch all matches with denormalized user data ─────────────────────────
  getAllMatches: async (): Promise<Match[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(`
        *,
        intendedParentData:users!matches_intended_parent_id_fkey(*),
        gestationalCarrierData:users!matches_gestational_carrier_id_fkey(*)
      `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapMatchFromDb);
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw error;
    }
  },

  // ─── Get a specific match ──────────────────────────────────────────────────
  getMatchById: async (id: string): Promise<Match | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(`
          *,
          intendedParentData:users!matches_intended_parent_id_fkey(*),
          gestationalCarrierData:users!matches_gestational_carrier_id_fkey(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data ? mapMatchFromDb(data) : null;
    } catch (error) {
      console.error('Error fetching match:', error);
      throw error;
    }
  },

  // ─── Get eligible surrogates ("Ready to Match" per client review) ─────────
  getEligibleSurrogates: async (): Promise<User[]> => {
    try {
      // Per client review: surrogates eligible to match must be "Ready to Match"
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['Surrogate', 'gestationalCarrier'])
        .eq('status', 'Ready to Match')
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching eligible surrogates:', error);
      throw error;
    }
  },

  // ─── Get eligible intended parents ("Match Pending" per client review) ────
  getEligibleParents: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['Intended Parent', 'intendedParent'])
        .eq('status', 'Match Pending')
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching eligible parents:', error);
      throw error;
    }
  },

  // ─── Create a new match (with eligibility validation) ──────────────────────
  createMatch: async (matchData: {
    intendedParentId: string;
    gestationalCarrierId: string;
    agencyNotes?: string;
    internalNotes?: string;
    coordinatorId?: string;
  }): Promise<string> => {
    try {
      // Validate IP eligibility
      const { data: ipData, error: ipError } = await supabase
        .from('users')
        .select('status, role')
        .eq('id', matchData.intendedParentId)
        .single();

      if (ipError) throw new Error('Could not verify IP eligibility');
      if (!['Intended Parent', 'intendedParent'].includes(ipData.role) || ipData.status !== 'Match Pending') {
        throw new Error('Intended Parent is not eligible for matching. Status must be "Match Pending".');
      }

      // Validate GC eligibility (must be Ready to Match per client review)
      const { data: gcData, error: gcError } = await supabase
        .from('users')
        .select('status, role, medical_screening_status, form_data')
        .eq('id', matchData.gestationalCarrierId)
        .single();

      if (gcError) throw new Error('Could not verify GC eligibility');
      if (!['Surrogate', 'gestationalCarrier'].includes(gcData.role) || gcData.status !== 'Ready to Match') {
        throw new Error('Gestational Carrier is not eligible for matching. Status must be "Ready to Match".');
      }

      // Per spec: prevent an IP or GC from being in two concurrent active matches
      const [ipActive, gcActive] = await Promise.all([
        matchService.hasActiveMatch(matchData.intendedParentId),
        matchService.hasActiveMatch(matchData.gestationalCarrierId),
      ]);
      if (ipActive) {
        throw new Error('Intended Parent already has an active match in progress (Proposed, Presented, Accepted, or Active). Resolve the existing match before creating a new one.');
      }
      if (gcActive) {
        throw new Error('Gestational Carrier already has an active match in progress (Proposed, Presented, Accepted, or Active). Resolve the existing match before creating a new one.');
      }

      // Create match
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          intended_parent_id: matchData.intendedParentId,
          gestational_carrier_id: matchData.gestationalCarrierId,
          agency_notes: matchData.agencyNotes,
          internal_notes: matchData.internalNotes,
          coordinator_id: matchData.coordinatorId,
          status: 'Proposed',
        })
        .select('id')
        .single();
      
      if (error) throw error;

      // Push: notify both parties that a match has been presented.
      void pushService.send(
        [matchData.intendedParentId, matchData.gestationalCarrierId],
        'New match to review',
        'A match has been presented. Open the app to accept or decline.',
        { type: 'match_presented', matchId: data.id },
      );

      return data.id;
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  },

  // ─── Validate status transition ────────────────────────────────────────────
  validateStatusTransition: (currentStatus: string, newStatus: MatchStatus, match: Match): string | null => {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return `Cannot transition from "${currentStatus}" to "${newStatus}".`;
    }

    // Guardrails per spec
    // Presented → Accepted: both parties must have accepted
    if (newStatus === 'Accepted' && (!match.parentAccepted || !match.surrogateAccepted)) {
      const missing = [];
      if (!match.parentAccepted) missing.push('Intended Parent');
      if (!match.surrogateAccepted) missing.push('Gestational Carrier');
      return `Cannot accept match: ${missing.join(' and ')} ha${missing.length === 1 ? 's' : 've'} not yet accepted the match.`;
    }
    if (newStatus === 'Active' && !match.journeyId) {
      return 'Cannot activate match: Journey must be created first. Use "Create Journey & Activate".';
    }
    if (newStatus === 'Delivered' && !match.deliveryDate) {
      return 'Cannot mark as delivered: Delivery date must be recorded first.';
    }
    if (newStatus === 'Completed' && !match.escrowClosedAt) {
      return 'Cannot complete match: Escrow closure must be confirmed first.';
    }
    if (newStatus === 'Cancelled' && !match.cancellationReason) {
      return 'Cannot cancel match: A cancellation reason is required.';
    }

    return null; // Valid
  },

  // ─── Update match status (with guardrails) ─────────────────────────────────
  updateMatchStatus: async (id: string, newStatus: MatchStatus, additionalData?: {
    deliveryDate?: string;
    escrowClosedAt?: string;
    cancellationReason?: string;
  }): Promise<void> => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'Accepted') {
        updateData.matched_at = new Date().toISOString();
      }

      // Include additional lifecycle data
      if (additionalData?.deliveryDate) {
        updateData.delivery_date = additionalData.deliveryDate;
      }
      if (additionalData?.escrowClosedAt) {
        updateData.escrow_closed_at = additionalData.escrowClosedAt;
      }
      if (additionalData?.cancellationReason) {
        updateData.cancellation_reason = additionalData.cancellationReason;
      }
      
      const { data: before } = await supabase
        .from(TABLE_NAME)
        .select('status, intended_parent_id, gestational_carrier_id')
        .eq('id', id)
        .single();
      const { error } = await supabase.from(TABLE_NAME).update(updateData).eq('id', id);
      if (error) throw error;
      auditService.log(`Match status changed: ${before?.status} → ${newStatus}`, 'match', id, {
        before: { status: before?.status },
        after: { status: newStatus, ...additionalData },
      });

      // Push: notify both parties when a match is cancelled, including the reason.
      if (newStatus === 'Cancelled') {
        const reason = additionalData?.cancellationReason
          ? ` Reason: ${additionalData.cancellationReason}`
          : '';
        void pushService.send(
          [before?.intended_parent_id, before?.gestational_carrier_id],
          'Match cancelled',
          `Your match has been cancelled.${reason} You can be presented with a new match.`,
          { type: 'match_cancelled', matchId: id },
        );
      }
    } catch (error) {
      console.error('Error updating match status:', error);
      throw error;
    }
  },

  // ─── Activate match (create journey + set to Active) ───────────────────────
  activateMatch: async (matchId: string, caseManagerId: string): Promise<string> => {
    try {
      // Fetch the match
      const match = await matchService.getMatchById(matchId);
      if (!match) throw new Error('Match not found');
      if (match.status !== 'Accepted') {
        throw new Error('Match must be in "Accepted" status to activate.');
      }
      if (!match.parentAccepted || !match.surrogateAccepted) {
        throw new Error('Cannot activate match: Both the Intended Parent and Gestational Carrier must accept the match before it can become Active.');
      }
      if (!isMatchChecklistComplete(match)) {
        throw new Error('Cannot activate match: complete the Match Progression checklist (records review, match meeting, and match confirmed) before starting the journey.');
      }
      if (!match.gestationalCarrierId) {
        throw new Error('Match must have a Gestational Carrier assigned.');
      }

      // Create the Journey
      const caseNumber = `CASE-${Date.now().toString().slice(-6)}`;
      const { data: journeyData, error: journeyError } = await supabase
        .from('journeys')
        .insert({
          match_id: matchId,
          case_number: caseNumber,
          parent_id: match.intendedParentId,
          surrogate_id: match.gestationalCarrierId,
          case_manager_id: caseManagerId,
          status: 'Active',
          stage: 'Medical Screening',
          journey_notes: {},
        })
        .select('id')
        .single();

      if (journeyError) throw journeyError;

      // Update match to Active with journey link
      const { error: matchError } = await supabase
        .from(TABLE_NAME)
        .update({
          status: 'Active',
          journey_id: journeyData.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (matchError) throw matchError;

      auditService.log('Match activated — Journey created', 'match', matchId, {
        after: { status: 'Active', journeyId: journeyData.id, caseNumber },
      });
      auditService.log('Journey created', 'journey', journeyData.id, {
        after: { matchId, caseNumber, stage: 'Medical Screening' },
      });

      return journeyData.id;
    } catch (error) {
      console.error('Error activating match:', error);
      throw error;
    }
  },

  // ─── Create / link journey when match is already Active but missing journey_id ─
  createJourneyForActiveMatch: async (matchId: string, caseManagerId: string): Promise<string> => {
    const match = await matchService.getMatchById(matchId);
    if (!match) throw new Error('Match not found');
    if (match.status !== 'Active') {
      throw new Error('Only an Active match can use this action.');
    }
    if (match.journeyId) {
      throw new Error('This match already has a journey linked.');
    }
    if (!match.parentAccepted || !match.surrogateAccepted) {
      throw new Error('Both the Intended Parent and Gestational Carrier must have accepted before a journey can be created.');
    }
    if (!match.gestationalCarrierId || !match.intendedParentId) {
      throw new Error('Match must have both an Intended Parent and a Gestational Carrier assigned.');
    }

    const { data: existingRows, error: existingErr } = await supabase
      .from('journeys')
      .select('id')
      .eq('match_id', matchId)
      .limit(1);
    if (existingErr) throw existingErr;

    const existingId = existingRows?.[0]?.id;
    if (existingId) {
      const { error: linkErr } = await supabase
        .from(TABLE_NAME)
        .update({
          journey_id: existingId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchId);
      if (linkErr) throw linkErr;
      await auditService.log('Journey linked to Active match (existing journey row)', 'match', matchId, {
        after: { journeyId: existingId },
      });
      return existingId;
    }

    const caseNumber = `CASE-${Date.now().toString().slice(-6)}`;
    const { data: journeyData, error: journeyError } = await supabase
      .from('journeys')
      .insert({
        match_id: matchId,
        case_number: caseNumber,
        parent_id: match.intendedParentId,
        surrogate_id: match.gestationalCarrierId,
        case_manager_id: caseManagerId,
        status: 'Active',
        stage: 'Medical Screening',
        journey_notes: {},
      })
      .select('id')
      .single();

    if (journeyError) throw journeyError;

    const { error: matchError } = await supabase
      .from(TABLE_NAME)
      .update({
        journey_id: journeyData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (matchError) throw matchError;

    await auditService.log('Journey created for Active match', 'match', matchId, {
      after: { journeyId: journeyData.id, caseNumber },
    });
    await auditService.log('Journey created', 'journey', journeyData.id, {
      after: { matchId, caseNumber, stage: 'Medical Screening' },
    });

    return journeyData.id;
  },

  // ─── Update arbitrary match fields ─────────────────────────────────────────
  updateMatch: async (id: string, updateData: Partial<Match>): Promise<void> => {
    try {
      const dbUpdate: any = {};
      
      if (updateData.status) dbUpdate.status = updateData.status;
      if (updateData.parentAccepted !== undefined) dbUpdate.parent_accepted = updateData.parentAccepted;
      if (updateData.surrogateAccepted !== undefined) dbUpdate.surrogate_accepted = updateData.surrogateAccepted;
      if (updateData.parentDeclined !== undefined) dbUpdate.parent_declined = updateData.parentDeclined;
      if (updateData.surrogateDeclined !== undefined) dbUpdate.surrogate_declined = updateData.surrogateDeclined;
      if (updateData.agencyNotes !== undefined) dbUpdate.agency_notes = updateData.agencyNotes;
      if (updateData.internalNotes !== undefined) dbUpdate.internal_notes = updateData.internalNotes;
      if (updateData.matchedAt) dbUpdate.matched_at = updateData.matchedAt;
      if (updateData.deliveryDate) dbUpdate.delivery_date = updateData.deliveryDate;
      if (updateData.escrowClosedAt) dbUpdate.escrow_closed_at = updateData.escrowClosedAt;
      if (updateData.cancellationReason) dbUpdate.cancellation_reason = updateData.cancellationReason;
      if (updateData.coordinatorId) dbUpdate.coordinator_id = updateData.coordinatorId;

      // Auto-cancellation: if anyone declines, cancel the match
      if (updateData.parentDeclined === true || updateData.surrogateDeclined === true) {
        dbUpdate.status = 'Cancelled';
        dbUpdate.cancellation_reason = dbUpdate.cancellation_reason || 
          (updateData.parentDeclined ? 'IP declined' : 'GC declined');
      }

      dbUpdate.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(dbUpdate)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating match:', error);
      throw error;
    }
  },

  // ─── Update the JSON `data` blob on a match ────────────────────────────────
  // Per client review: the Match Progression checklist failed because the page
  // called matchService.updateMatchData but no such method existed (silent
  // import-side ReferenceError). Provide it so toggles persist.
  updateMatchData: async (id: string, data: Record<string, any>): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({
          data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating match data:', error);
      throw error;
    }
  },

  // ─── Get matches by status ─────────────────────────────────────────────────
  getMatchesByStatus: async (status: MatchStatus): Promise<Match[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(`
          *,
          intendedParentData:users!matches_intended_parent_id_fkey(*),
          gestationalCarrierData:users!matches_gestational_carrier_id_fkey(*)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapMatchFromDb);
    } catch (error) {
      console.error('Error fetching matches by status:', error);
      throw error;
    }
  },

  // ─── Check if a GC/IP already has an active match ─────────────────────────
  hasActiveMatch: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .or(`intended_parent_id.eq.${userId},gestational_carrier_id.eq.${userId}`)
        .in('status', ['Proposed', 'Presented', 'Accepted', 'Active'])
        .limit(1);

      if (error) throw error;
      return (data || []).length > 0;
    } catch (error) {
      console.error('Error checking active match:', error);
      return false;
    }
  },

  // ─── Delete match and dependent journey-scoped rows (admin) ───────────────
  deleteMatch: async (id: string): Promise<void> => {
    const before = await matchService.getMatchById(id);
    if (!before) throw new Error('Match not found');

    const { data: journeys, error: jListErr } = await supabase
      .from('journeys')
      .select('id')
      .eq('match_id', id);
    if (jListErr) throw jListErr;

    const jids = (journeys || []).map((j: { id: string }) => j.id);

    const { error: clearJourneyFk } = await supabase
      .from(TABLE_NAME)
      .update({ journey_id: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (clearJourneyFk) throw clearJourneyFk;

    if (jids.length > 0) {
      const tablesWithJourneyId = [
        'agency_financials',
        'baby_watch_updates',
        'appointments',
        'payments',
        'tasks',
        'documents',
      ] as const;
      for (const t of tablesWithJourneyId) {
        const { error } = await supabase.from(t).delete().in('journey_id', jids);
        if (error) throw error;
      }

      const { data: convs, error: convSelErr } = await supabase
        .from('conversations')
        .select('id')
        .in('journey_id', jids);
      if (convSelErr) throw convSelErr;
      const cids = (convs || []).map((c: { id: string }) => c.id);
      if (cids.length > 0) {
        const { error: msgErr } = await supabase.from('messages').delete().in('conversation_id', cids);
        if (msgErr) throw msgErr;
        const { error: partErr } = await supabase.from('conversation_participants').delete().in('conversation_id', cids);
        if (partErr) throw partErr;
      }
      const { error: convDelErr } = await supabase.from('conversations').delete().in('journey_id', jids);
      if (convDelErr) throw convDelErr;

      const { error: delJourneysErr } = await supabase.from('journeys').delete().eq('match_id', id);
      if (delJourneysErr) throw delJourneysErr;
    }

    const { error: delMatchErr } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (delMatchErr) throw delMatchErr;

    await auditService.log('Match deleted', 'match', id, {
      before: {
        status: before.status,
        journeyId: before.journeyId,
        intendedParentId: before.intendedParentId,
        gestationalCarrierId: before.gestationalCarrierId,
      },
    });
  },
};
