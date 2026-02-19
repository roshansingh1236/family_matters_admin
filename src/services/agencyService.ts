import { supabase } from '../lib/supabase';
import type { AgencyTransaction } from '../types';

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

