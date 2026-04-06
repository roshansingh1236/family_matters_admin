import { supabase } from '../lib/supabase';

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export type AuditEntityType =
  | 'match'
  | 'journey'
  | 'user'
  | 'transaction'
  | 'reimbursable'
  | 'contract'
  | 'screening'
  | 'installment'
  | 'record_request';

const TABLE_NAME = 'audit_log';

export const auditService = {
  // Log an action — call this after any significant admin action.
  // Actor is auto-resolved from the current Supabase session if not supplied.
  log: async (
    action: string,
    entityType: AuditEntityType,
    entityId?: string,
    data?: { before?: Record<string, unknown>; after?: Record<string, unknown>; actorId?: string; actorEmail?: string }
  ): Promise<void> => {
    try {
      let actorId = data?.actorId;
      let actorEmail = data?.actorEmail;
      if (!actorId) {
        const { data: sessionData } = await supabase.auth.getSession();
        actorId = sessionData?.session?.user?.id;
        actorEmail = actorEmail || sessionData?.session?.user?.email;
      }
      await supabase.from(TABLE_NAME).insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        before_data: data?.before,
        after_data: data?.after,
        actor_id: actorId,
        actor_email: actorEmail,
      });
    } catch (error) {
      // Audit log failures must not break the main flow
      console.warn('Audit log write failed:', error);
    }
  },

  getAll: async (filters?: { entityType?: string; actorId?: string; limit?: number }): Promise<AuditLogEntry[]> => {
    try {
      let query = supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 200);

      if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters?.actorId) query = query.eq('actor_id', filters.actorId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return [];
    }
  },

  getByEntity: async (entityType: string, entityId: string): Promise<AuditLogEntry[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (error) {
      console.error('Error fetching entity audit log:', error);
      return [];
    }
  },
};

function mapRow(r: any): AuditLogEntry {
  return {
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    beforeData: r.before_data,
    afterData: r.after_data,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  };
}
