import { supabase } from '../lib/supabase';
import type { Journey, JourneyStatus, CaseMilestone } from '../types';

const TABLE_NAME = 'journeys';

// Helper to map DB snake_case to Frontend camelCase
const mapJourneyFromDb = (dbJourney: any): Journey => ({
  id: dbJourney.id,
  matchId: dbJourney.match_id,
  caseNumber: dbJourney.case_number,
  intendedParentId: dbJourney.parent_id || dbJourney.intended_parent_id,
  gestationalCarrierId: dbJourney.surrogate_id || dbJourney.gestational_carrier_id,
  caseManagerId: dbJourney.case_manager_id,
  status: dbJourney.status,
  createdAt: dbJourney.created_at,
  completedAt: dbJourney.completed_at,
  estimatedDeliveryDate: dbJourney.estimated_delivery_date,
  milestones: dbJourney.milestones || [],
  documents: dbJourney.documents || [],
  payments: dbJourney.payments || [],
  medicalRecords: dbJourney.medical_records,
  legalAgreements: dbJourney.legal_agreements,
  journeyNotes: dbJourney.journey_notes,
});

export const journeyService = {
  // Fetch all journeys
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

  // Get a specific journey
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

  // Create a new journey (usually from a match)
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
          status: journeyData.status || 'Medical Screening',
          journey_notes: journeyData.journeyNotes || {}
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

  // Update journey status
  updateJourneyStatus: async (id: string, newStatus: JourneyStatus): Promise<void> => {
    try {
      const updateData: any = {
        status: newStatus
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

  // Update Milestones
  updateMilestone: async (journeyId: string, milestone: CaseMilestone): Promise<void> => {
    try {
      const journey = await journeyService.getJourneyById(journeyId) as any;
      if (!journey) throw new Error('Journey not found');
      
      const journeyNotes = journey.journey_notes || {};
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

  // Get journeys by status
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
  }
};

