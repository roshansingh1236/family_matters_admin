import { supabase } from '../lib/supabase';

export interface Contract {
  id: string;
  title: string;
  type: string;
  surrogateName: string;
  parentName: string;
  status: string;
  createdAt: string;
  value: number;
  surrogate_id?: string;
  parent_id?: string;
}

const TABLE_NAME = 'contracts';

export const contractService = {
  // Fetch all contracts
  getAllContracts: async (): Promise<Contract[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(c => ({
        id: c.id,
        title: c.title,
        type: c.type,
        surrogateName: c.surrogate_name || 'Unknown',
        parentName: c.parent_name || 'Unknown',
        status: c.status,
        createdAt: c.created_at,
        value: c.value || 0,
        surrogate_id: c.surrogate_id,
        parent_id: c.parent_id
      }));
    } catch (error) {
      console.error('Error fetching contracts:', error);
      throw error;
    }
  },

  // Create a new contract
  createContract: async (contract: Partial<Contract>): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
          title: contract.title,
          type: contract.type,
          surrogate_name: contract.surrogateName,
          parent_name: contract.parentName,
          status: contract.status || 'draft',
          value: contract.value,
          surrogate_id: contract.surrogate_id,
          parent_id: contract.parent_id
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating contract:', error);
      throw error;
    }
  },

  // Update contract status
  updateContractStatus: async (id: string, status: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  }
};
