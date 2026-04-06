import { supabase } from '../lib/supabase';
import type { AgencyReimbursable, ReimbursableStatus } from '../types';

const TABLE_NAME = 'agency_reimbursables';

export const reimbursableService = {
  getAllReimbursables: async (): Promise<AgencyReimbursable[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('submitted_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (error) {
      console.error('Error fetching reimbursables:', error);
      return [];
    }
  },

  getByJourneyId: async (journeyId: string): Promise<AgencyReimbursable[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('journey_id', journeyId)
        .order('submitted_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (error) {
      console.error('Error fetching journey reimbursables:', error);
      return [];
    }
  },

  addReimbursable: async (r: Omit<AgencyReimbursable, 'id' | 'createdAt'>): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: r.journeyId,
          gc_id: r.gcId,
          category: r.category,
          amount: r.amount,
          approved_amount: r.approvedAmount,
          receipt_url: r.receiptUrl,
          description: r.description,
          incurred_date: r.incurredDate,
          submitted_date: r.submittedDate,
          status: r.status,
          review_notes: r.reviewNotes,
          reimbursed_date: r.reimbursedDate,
          created_by: r.createdBy,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error adding reimbursable:', error);
      throw error;
    }
  },

  updateReimbursable: async (id: string, updates: Partial<AgencyReimbursable>): Promise<void> => {
    try {
      const payload: any = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.approvedAmount !== undefined) payload.approved_amount = updates.approvedAmount;
      if (updates.reviewNotes !== undefined) payload.review_notes = updates.reviewNotes;
      if (updates.reimbursedDate !== undefined) payload.reimbursed_date = updates.reimbursedDate;
      if (updates.receiptUrl !== undefined) payload.receipt_url = updates.receiptUrl;

      const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating reimbursable:', error);
      throw error;
    }
  },

  deleteReimbursable: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting reimbursable:', error);
      throw error;
    }
  },

  // Aging report: buckets outstanding reimbursables by 0-30, 31-60, 61-90, 90+ days
  getAgingReport: async (): Promise<{ bucket: string; count: number; totalAmount: number }[]> => {
    try {
      const all = await reimbursableService.getAllReimbursables();
      const outstanding = all.filter(r => r.status !== 'Reimbursed' && r.status !== 'Denied');
      const now = new Date();
      const buckets = [
        { label: '0–30 days', min: 0, max: 30 },
        { label: '31–60 days', min: 31, max: 60 },
        { label: '61–90 days', min: 61, max: 90 },
        { label: '90+ days', min: 91, max: Infinity },
      ];
      return buckets.map(b => {
        const items = outstanding.filter(r => {
          const days = Math.floor((now.getTime() - new Date(r.submittedDate).getTime()) / 86400000);
          return days >= b.min && days <= b.max;
        });
        return {
          bucket: b.label,
          count: items.length,
          totalAmount: items.reduce((s, r) => s + r.amount, 0),
        };
      });
    } catch (error) {
      console.error('Error computing aging report:', error);
      return [];
    }
  },

  // Per-journey financial summary
  getJourneySummary: async (journeyId: string): Promise<{
    agencyFeesPaid: number;
    agencyFeesOutstanding: number;
    reimbursablesPaid: number;
    reimbursablesOutstanding: number;
  }> => {
    try {
      const reimbursables = await reimbursableService.getByJourneyId(journeyId);
      const reimbursablesPaid = reimbursables
        .filter(r => r.status === 'Reimbursed')
        .reduce((s, r) => s + (r.approvedAmount ?? r.amount), 0);
      const reimbursablesOutstanding = reimbursables
        .filter(r => r.status !== 'Reimbursed' && r.status !== 'Denied')
        .reduce((s, r) => s + r.amount, 0);

      // Agency fees for this journey from agency_financials
      const { data: feeData } = await supabase
        .from('agency_financials')
        .select('amount, status')
        .eq('journey_id', journeyId)
        .eq('category', 'Agency Fee');

      const agencyFeesPaid = (feeData || [])
        .filter((t: any) => t.status === 'Completed')
        .reduce((s: number, t: any) => s + t.amount, 0);
      const agencyFeesOutstanding = (feeData || [])
        .filter((t: any) => t.status === 'Pending')
        .reduce((s: number, t: any) => s + t.amount, 0);

      return { agencyFeesPaid, agencyFeesOutstanding, reimbursablesPaid, reimbursablesOutstanding };
    } catch (error) {
      console.error('Error fetching journey summary:', error);
      return { agencyFeesPaid: 0, agencyFeesOutstanding: 0, reimbursablesPaid: 0, reimbursablesOutstanding: 0 };
    }
  },
};

function mapRow(t: any): AgencyReimbursable {
  return {
    id: t.id,
    journeyId: t.journey_id,
    gcId: t.gc_id,
    category: t.category,
    amount: t.amount,
    approvedAmount: t.approved_amount,
    receiptUrl: t.receipt_url,
    description: t.description,
    incurredDate: t.incurred_date,
    submittedDate: t.submitted_date,
    status: t.status,
    reviewNotes: t.review_notes,
    reimbursedDate: t.reimbursed_date,
    createdBy: t.created_by,
    createdAt: t.created_at,
  };
}
