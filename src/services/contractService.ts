import { supabase } from '../lib/supabase';
import { auditService } from './auditService';

export type ContractEsignStatus = 'Not Sent' | 'Sent to GC' | 'Sent to IP' | 'Partially Signed' | 'Fully Signed' | 'Expired';

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
  journeyId?: string;
  esignStatus?: ContractEsignStatus;
  esignSentAt?: string;
  esignSignedAt?: string;
  documentUrl?: string;
  notes?: string;
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
      
      return (data || []).map(mapRow);
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
          parent_id: contract.parent_id,
          journey_id: contract.journeyId,
          document_url: contract.documentUrl,
          notes: contract.notes,
          esign_status: contract.esignStatus || 'Not Sent',
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
      const { data: before } = await supabase.from(TABLE_NAME).select('status').eq('id', id).single();
      const { error } = await supabase.from(TABLE_NAME).update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      auditService.log(`Contract status changed: ${before?.status} → ${status}`, 'contract', id, {
        before: { status: before?.status }, after: { status },
      });
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  },

  // Update e-sign status
  updateEsignStatus: async (id: string, esignStatus: ContractEsignStatus): Promise<void> => {
    try {
      const updates: any = { esign_status: esignStatus, updated_at: new Date().toISOString() };
      if (esignStatus === 'Sent to GC' || esignStatus === 'Sent to IP') updates.esign_sent_at = new Date().toISOString();
      if (esignStatus === 'Fully Signed') { updates.esign_signed_at = new Date().toISOString(); updates.status = 'active'; }
      const { error } = await supabase.from(TABLE_NAME).update(updates).eq('id', id);
      if (error) throw error;
      auditService.log(`Contract e-sign status → ${esignStatus}`, 'contract', id, { after: { esignStatus } });
    } catch (error) {
      console.error('Error updating e-sign status:', error);
      throw error;
    }
  },

  deleteContract: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting contract:', error);
      throw error;
    }
  },
};

function mapRow(c: any): Contract {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    surrogateName: c.surrogate_name || 'Unknown',
    parentName: c.parent_name || 'Unknown',
    status: c.status,
    createdAt: c.created_at,
    value: c.value || 0,
    surrogate_id: c.surrogate_id,
    parent_id: c.parent_id,
    journeyId: c.journey_id,
    esignStatus: c.esign_status,
    esignSentAt: c.esign_sent_at,
    esignSignedAt: c.esign_signed_at,
    documentUrl: c.document_url,
    notes: c.notes,
  };
}
