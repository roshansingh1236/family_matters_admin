import { supabase } from '../lib/supabase';
import type { AgencyTransaction, AgencyFeeInstallment } from '../types';
import { auditService } from './auditService';

const TABLE_NAME = 'agency_financials';

export const agencyService = {
  // Fetch all transactions
  getAllTransactions: async (): Promise<AgencyTransaction[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as AgencyTransaction[];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },

  // Fetch transactions by Journey ID
  getTransactionsByJourneyId: async (journeyId: string): Promise<AgencyTransaction[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('journey_id', journeyId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as AgencyTransaction[];
    } catch (error) {
       console.error('Error fetching journey transactions:', error);
       return [];
    }
  },

  // Add a new transaction
  addTransaction: async (transaction: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: transaction.journeyId,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description,
          status: transaction.status,
          date: transaction.date,
          created_by: transaction.createdBy
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  },

  // Update a transaction
  updateTransaction: async (id: string, updates: Partial<AgencyTransaction>): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  },

  // Delete a transaction
  deleteTransaction: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  // ── Agency Fee Installments (per spec: tracked per IP, separate from escrow) ──
  // Stored as individual AgencyTransaction records with reference = "installment:{n}"
  // and intended_parent_id set to the IP's user ID.

  getInstallmentsByIpId: async (intendedParentId: string): Promise<AgencyFeeInstallment[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('intended_parent_id', intendedParentId)
        .eq('category', 'Agency Fee')
        .order('reference', { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        intendedParentId: t.intended_parent_id,
        installmentNumber: parseInt(t.reference?.replace('installment:', '') || '1', 10),
        totalInstallments: 0, // computed client-side from set count
        amount: t.amount,
        dueDate: t.date,
        paidDate: t.status === 'Completed' ? t.date : undefined,
        status: t.status === 'Completed' ? 'Paid'
              : t.status === 'Cancelled' ? 'Waived'
              : new Date(t.date) < new Date() ? 'Overdue'
              : 'Pending',
        waiverReason: t.waiverReason,
        notes: t.description,
        createdAt: t.createdAt,
      })) as AgencyFeeInstallment[];
    } catch (error) {
      console.error('Error fetching installments:', error);
      return [];
    }
  },

  // Create a full installment schedule for an IP (creates N transaction records)
  createInstallmentSchedule: async (intendedParentId: string, installments: Array<{ amount: number; dueDate: string; notes?: string }>): Promise<void> => {
    try {
      const records = installments.map((inst, i) => ({
        intended_parent_id: intendedParentId,
        type: 'Revenue',
        category: 'Agency Fee',
        amount: inst.amount,
        date: inst.dueDate,
        description: inst.notes || `Agency Fee – Installment ${i + 1}`,
        status: 'Pending',
        reference: `installment:${i + 1}`,
        created_by: 'admin',
      }));
      const { error } = await supabase.from(TABLE_NAME).insert(records);
      if (error) throw error;
    } catch (error) {
      console.error('Error creating installment schedule:', error);
      throw error;
    }
  },

  // Mark an installment as paid
  markInstallmentPaid: async (installmentId: string, paidDate?: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ status: 'Completed', date: paidDate || new Date().toISOString().split('T')[0] })
        .eq('id', installmentId);
      if (error) throw error;
      auditService.log('Agency fee installment marked paid', 'installment', installmentId, {
        after: { status: 'Completed', paidDate: paidDate || new Date().toISOString().split('T')[0] },
      });
    } catch (error) {
      console.error('Error marking installment paid:', error);
      throw error;
    }
  },

  // Waive an installment (admin only, requires reason)
  waiveInstallment: async (installmentId: string, reason: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ status: 'Cancelled', description: `[WAIVED] ${reason}` })
        .eq('id', installmentId);
      if (error) throw error;
      auditService.log('Agency fee installment waived', 'installment', installmentId, {
        after: { status: 'Waived', reason },
      });
    } catch (error) {
      console.error('Error waiving installment:', error);
      throw error;
    }
  },

  // MTD / YTD revenue breakdown
  getMtdYtdSummary: async (): Promise<{ mtdRevenue: number; ytdRevenue: number; mtdExpenses: number; ytdExpenses: number }> => {
    try {
      const transactions = await agencyService.getAllTransactions();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const completed = transactions.filter(t => t.status === 'Completed');

      const mtdRevenue = completed
        .filter(t => t.type === 'Revenue' && new Date(t.date) >= startOfMonth)
        .reduce((s, t) => s + t.amount, 0);
      const ytdRevenue = completed
        .filter(t => t.type === 'Revenue' && new Date(t.date) >= startOfYear)
        .reduce((s, t) => s + t.amount, 0);
      const mtdExpenses = completed
        .filter(t => t.type === 'Expense' && new Date(t.date) >= startOfMonth)
        .reduce((s, t) => s + t.amount, 0);
      const ytdExpenses = completed
        .filter(t => t.type === 'Expense' && new Date(t.date) >= startOfYear)
        .reduce((s, t) => s + t.amount, 0);

      return { mtdRevenue, ytdRevenue, mtdExpenses, ytdExpenses };
    } catch (error) {
      console.error('Error computing MTD/YTD:', error);
      return { mtdRevenue: 0, ytdRevenue: 0, mtdExpenses: 0, ytdExpenses: 0 };
    }
  },

  // Check if agency fee requirements are satisfied for an IP (non-financial indicator for Case Managers)
  isAgencyFeeSatisfied: async (intendedParentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('agency_financials')
        .select('status')
        .eq('intended_parent_id', intendedParentId)
        .eq('category', 'Agency Fee');
      if (error) throw error;
      if (!data || data.length === 0) return false;
      return data.every((t: any) => t.status === 'Completed' || t.status === 'Waived');
    } catch (error) {
      console.error('Error checking agency fee status:', error);
      return false;
    }
  },

  // Get Financial Summary
  getFinancialSummary: async () => {
    try {
      const transactions = await agencyService.getAllTransactions();
      
      const totalRevenue = transactions
        .filter(t => t.type === 'Revenue' && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'Expense' && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const pendingRevenue = transactions
        .filter(t => t.type === 'Revenue' && t.status === 'Pending')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        pendingRevenue
      };
    } catch (error) {
      console.error('Error calculating summary:', error);
      return { totalRevenue: 0, totalExpenses: 0, netIncome: 0, pendingRevenue: 0 };
    }
  }
};

