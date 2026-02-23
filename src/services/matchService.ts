import { supabase } from '../lib/supabase';
import type { Match, MatchStatus } from '../types';

const TABLE_NAME = 'matches';

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
  // These might need further mapping if nested
   intendedParentData: dbMatch.intendedParentData,      // ✅ camelCase
  gestationalCarrierData: dbMatch.gestationalCarrierData, // ✅ camelCase
});

export const matchService = {
  // Fetch all matches
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

  // Get a specific match
  getMatchById: async (id: string): Promise<Match | null> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data ? mapMatchFromDb(data) : null;
    } catch (error) {
      console.error('Error fetching match:', error);
      throw error;
    }
  },

  // Create a new match
  createMatch: async (matchData: any): Promise<string> => {
    try {
      // Map frontend camelCase to backend snake_case
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          parent_id: matchData.intendedParentId,
          surrogate_id: matchData.gestationalCarrierId,
          match_score: matchData.matchScore,
          agency_notes: matchData.agencyNotes,
          status: 'Proposed'
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  },

  // Update match status
  updateMatchStatus: async (id: string, newStatus: MatchStatus): Promise<void> => {
    try {
      const updateData: any = {
        status: newStatus
      };
      
      if (newStatus === 'Accepted') {
         updateData.matched_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating match status:', error);
      throw error;
    }
  },

  // Get matches by status
  getMatchesByStatus: async (status: MatchStatus): Promise<Match[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapMatchFromDb);
    } catch (error) {
      console.error('Error fetching matches by status:', error);
      throw error;
    }
  }
};

