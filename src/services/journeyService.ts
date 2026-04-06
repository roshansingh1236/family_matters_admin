import { supabase } from '../lib/supabase';
import type { Journey, JourneyStatus, JourneyStage, CaseMilestone } from '../types';
import { auditService } from './auditService';

const TABLE_NAME = 'journeys';

// All operational sub-stages in order
export const JOURNEY_STAGES: JourneyStage[] = [
  'Medical Screening',
  'Legal',
  'Embryo Transfer',
  'Pregnancy',
  'Birth',
  'Postpartum',
];

// Helper to map DB snake_case to Frontend camelCase
const mapJourneyFromDb = (dbJourney: any): Journey => ({
  id: dbJourney.id,
  matchId: dbJourney.match_id,
  caseNumber: dbJourney.case_number,
  intendedParentId: dbJourney.parent_id || dbJourney.intended_parent_id,
  gestationalCarrierId: dbJourney.surrogate_id || dbJourney.gestational_carrier_id,
  caseManagerId: dbJourney.case_manager_id,
  status: dbJourney.status,
  stage: dbJourney.stage || 'Medical Screening',
  createdAt: dbJourney.created_at,
  completedAt: dbJourney.completed_at,
  estimatedDeliveryDate: dbJourney.estimated_delivery_date,
  deliveryDate: dbJourney.delivery_date,
  postpartumNotes: dbJourney.postpartum_notes,
  milestones: dbJourney.milestones || [],
  documents: dbJourney.documents || [],
  payments: dbJourney.payments || [],
  medicalRecords: dbJourney.medical_records,
  legalAgreements: dbJourney.legal_agreements,
  journeyNotes: dbJourney.journey_notes,
});

export const journeyService = {
  // ─── Fetch all journeys ────────────────────────────────────────────────────
  getAllJourneys: async (): Promise<Journey[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapJourneyFromDb);
    } catch (error) {
      console.error('Error fetching journeys:', error);
      throw error;
    }
  },

  // ─── Get a specific journey ────────────────────────────────────────────────
  getJourneyById: async (id: string): Promise<Journey | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data ? mapJourneyFromDb(data) : null;
    } catch (error) {
      console.error('Error fetching journey:', error);
      throw error;
    }
  },

  // ─── Get journey by match ID ───────────────────────────────────────────────
  getJourneyByMatchId: async (matchId: string): Promise<Journey | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();
      
      if (error) throw error;
      return data ? mapJourneyFromDb(data) : null;
    } catch (error) {
      console.error('Error fetching journey by match:', error);
      throw error;
    }
  },

  // ─── Create a new journey (called via matchService.activateMatch) ──────────
  createJourney: async (journeyData: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          match_id: journeyData.matchId,
          case_number: journeyData.caseNumber,
          parent_id: journeyData.intendedParentId,
          surrogate_id: journeyData.gestationalCarrierId,
          case_manager_id: journeyData.caseManagerId,
          status: 'Active',
          stage: 'Medical Screening',
          journey_notes: journeyData.journeyNotes || {},
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating journey:', error);
      throw error;
    }
  },

  // ─── Update journey stage (operational sub-stage progression) ──────────────
  updateJourneyStage: async (id: string, newStage: JourneyStage): Promise<void> => {
    try {
      const { data: before } = await supabase.from(TABLE_NAME).select('stage').eq('id', id).single();
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      auditService.log(`Journey stage changed: ${before?.stage} → ${newStage}`, 'journey', id, {
        before: { stage: before?.stage },
        after: { stage: newStage },
      });
    } catch (error) {
      console.error('Error updating journey stage:', error);
      throw error;
    }
  },

  // ─── Update journey status (top-level: Active → Completed/Cancelled) ──────
  updateJourneyStatus: async (id: string, newStatus: JourneyStatus): Promise<void> => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      if (newStatus === 'Completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating journey status:', error);
      throw error;
    }
  },

  // ─── Update delivery date + sync Match → Delivered ────────────────────────
  updateDeliveryDate: async (id: string, deliveryDate: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({
          delivery_date: deliveryDate,
          stage: 'Postpartum',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Per spec: recording delivery must also advance Match status to Delivered
      const journey = await journeyService.getJourneyById(id);
      if (journey?.matchId) {
        await supabase
          .from('matches')
          .update({
            status: 'Delivered',
            delivery_date: deliveryDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', journey.matchId)
          .eq('status', 'Active'); // Only advance if currently Active
      }
    } catch (error) {
      console.error('Error updating delivery date:', error);
      throw error;
    }
  },

  // ─── Get next stage ────────────────────────────────────────────────────────
  getNextStage: (currentStage: string): JourneyStage | null => {
    const idx = JOURNEY_STAGES.indexOf(currentStage as JourneyStage);
    if (idx !== -1 && idx < JOURNEY_STAGES.length - 1) {
      return JOURNEY_STAGES[idx + 1];
    }
    return null;
  },

  // ─── Get stage progress percentage ─────────────────────────────────────────
  getStageProgress: (stage: string): number => {
    const idx = JOURNEY_STAGES.indexOf(stage as JourneyStage);
    if (idx === -1) return 0;
    return Math.round(((idx + 1) / JOURNEY_STAGES.length) * 100);
  },

  // ─── Update Milestones ─────────────────────────────────────────────────────
  updateMilestone: async (journeyId: string, milestone: CaseMilestone): Promise<void> => {
    try {
      const journey = await journeyService.getJourneyById(journeyId) as any;
      if (!journey) throw new Error('Journey not found');
      
      const journeyNotes = journey.journeyNotes || {};
      const milestones = journeyNotes.milestones || [];
      const index = milestones.findIndex((m: any) => m.id === milestone.id);
      
      if (index !== -1) {
        milestones[index] = milestone;
      } else {
        milestones.push(milestone);
      }
      
      journeyNotes.milestones = milestones;
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ journey_notes: journeyNotes })
        .eq('id', journeyId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating milestone:', error);
      throw error;
    }
  },

  // ─── Get journeys by status ────────────────────────────────────────────────
  getJourneysByStatus: async (status: JourneyStatus): Promise<Journey[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapJourneyFromDb);
    } catch (error) {
      console.error('Error fetching journeys by status:', error);
      throw error;
    }
  },

  // ─── Update estimated delivery date ───────────────────────────────────────
  updateEstimatedDeliveryDate: async (id: string, edd: string): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).update({
        estimated_delivery_date: edd,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating EDD:', error);
      throw error;
    }
  },

  // ─── Update medical records section ───────────────────────────────────────
  updateMedicalRecords: async (id: string, medicalRecords: Record<string, unknown>): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).update({
        medical_records: medicalRecords,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating medical records:', error);
      throw error;
    }
  },

  // ─── Update legal agreements section ──────────────────────────────────────
  updateLegalAgreements: async (id: string, legalAgreements: Record<string, unknown>): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).update({
        legal_agreements: legalAgreements,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating legal agreements:', error);
      throw error;
    }
  },

  // ─── Update journey notes (generic JSON blob) ─────────────────────────────
  updateJourneyNotes: async (id: string, notes: Record<string, unknown>): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).update({
        journey_notes: notes,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating journey notes:', error);
      throw error;
    }
  },

  // ─── Update postpartum notes ───────────────────────────────────────────────
  updatePostpartumNotes: async (id: string, notes: string): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).update({
        postpartum_notes: notes,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating postpartum notes:', error);
      throw error;
    }
  },

  // ─── Close escrow + complete match (final lifecycle step per spec) ───────────
  // Per spec: Match cannot go to Completed until escrow closure is confirmed.
  // This sets escrow_closed_at on both Journey and Match, then advances both to Completed.
  closeEscrow: async (journeyId: string, notes?: string): Promise<void> => {
    try {
      const closedAt = new Date().toISOString();

      // Update journey to Completed
      const journeyUpdate: any = {
        status: 'Completed',
        completed_at: closedAt,
        updated_at: closedAt,
      };
      if (notes) journeyUpdate.postpartum_notes = notes;

      const { error: journeyError } = await supabase
        .from(TABLE_NAME)
        .update(journeyUpdate)
        .eq('id', journeyId);

      if (journeyError) throw journeyError;

      // Advance linked match: Escrow Closure → Completed
      const journey = await journeyService.getJourneyById(journeyId);
      if (journey?.matchId) {
        const { error: matchError } = await supabase
          .from('matches')
          .update({
            status: 'Completed',
            escrow_closed_at: closedAt,
            updated_at: closedAt,
          })
          .eq('id', journey.matchId)
          .eq('status', 'Escrow Closure'); // Only advance if currently at Escrow Closure

        if (matchError) throw matchError;
      }
      auditService.log('Escrow closed — Journey and Match marked Completed', 'journey', journeyId, {
        after: { status: 'Completed', completedAt: closedAt },
      });
    } catch (error) {
      console.error('Error closing escrow:', error);
      throw error;
    }
  },

  // ─── Get journeys by stage ─────────────────────────────────────────────────
  getJourneysByStage: async (stage: JourneyStage): Promise<Journey[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('stage', stage)
        .eq('status', 'Active')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapJourneyFromDb);
    } catch (error) {
      console.error('Error fetching journeys by stage:', error);
      throw error;
    }
  },

  // ─── Delete journey + journey-scoped rows; clears matches.journey_id (admin) ─
  deleteJourney: async (journeyId: string): Promise<void> => {
    const before = await journeyService.getJourneyById(journeyId);
    if (!before) throw new Error('Journey not found');

    const jids = [journeyId];
    const now = new Date().toISOString();

    if (before.matchId) {
      const { error: clearJourneyFk } = await supabase
        .from('matches')
        .update({ journey_id: null, updated_at: now })
        .eq('id', before.matchId)
        .eq('journey_id', journeyId);
      if (clearJourneyFk) throw clearJourneyFk;
    }

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

    const { error: delJourneyErr } = await supabase.from(TABLE_NAME).delete().eq('id', journeyId);
    if (delJourneyErr) throw delJourneyErr;

    await auditService.log('Journey deleted', 'journey', journeyId, {
      before: {
        caseNumber: before.caseNumber,
        matchId: before.matchId,
        status: before.status,
        stage: before.stage,
      },
    });
  },
};
