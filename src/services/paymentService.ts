
import { supabase } from '../lib/supabase';
import type { Payment } from '../types';

const TABLE_NAME = 'payments';

export const paymentService = {
  // Fetch all payments
  getAllPayments: async (): Promise<Payment[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(p => ({
          id: p.id,
          surrogateId: p.surrogate_id,
          parentId: p.parent_id,
          amount: Number(p.amount),
          type: p.type,
          category: p.category,
          status: p.status,
          dueDate: p.due_date,
          paidDate: p.paid_date,
          description: p.description,
          referenceNumber: p.reference_number,
          createdAt: p.created_at
      })) as any[];
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  },

  // Create a new payment
  createPayment: async (payment: any): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          journey_id: payment.journeyId,
          surrogate_id: payment.surrogateId,
          parent_id: payment.parentId,
          amount: payment.amount,
          type: payment.type,
          category: payment.category,
          status: payment.status,
          due_date: payment.dueDate,
          paid_date: payment.paidDate,
          description: payment.description || payment.notes,
          reference_number: payment.referenceNumber
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  },

  // Update a payment
  updatePayment: async (id: string, updates: any): Promise<void> => {
    try {
      const mappedUpdates: any = {};
      if (updates.amount) mappedUpdates.amount = updates.amount;
      if (updates.status) mappedUpdates.status = updates.status;
      if (updates.paidDate) mappedUpdates.paid_date = updates.paidDate;
      if (updates.referenceNumber) mappedUpdates.reference_number = updates.referenceNumber;
      if (updates.description || updates.notes) mappedUpdates.description = updates.description || updates.notes;

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(mappedUpdates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  },

  // Delete a payment
  deletePayment: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  },

  // Get payments for a specific surrogate
  getPaymentsBySurrogateId: async (surrogateId: string): Promise<Payment[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('surrogate_id', surrogateId)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(p => ({
          id: p.id,
          surrogateId: p.surrogate_id,
          amount: Number(p.amount),
          type: p.type,
          status: p.status,
          dueDate: p.due_date,
          createdAt: p.created_at
      })) as any[];
    } catch (error) {
       console.error('Error fetching surrogate payments:', error);
       return [];
    }
  }
};

