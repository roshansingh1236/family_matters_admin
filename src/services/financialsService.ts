import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase'; // Assuming there is a types file, if not we'll use any
import { pushService } from './pushService';

// uuid columns reject empty strings ("invalid input syntax for type uuid").
// Coerce empty-string values on known id keys to null before insert.
const UUID_KEYS = new Set([
  'journey_id', 'user_id', 'surrogate_id', 'parent_id',
  'intended_parent_id', 'gestational_carrier_id',
]);
function cleanUuids<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = { ...obj };
  for (const k of Object.keys(out)) {
    if (UUID_KEYS.has(k) && typeof out[k] === 'string' && out[k].trim() === '') {
      out[k] = null;
    }
  }
  return out as T;
}

export const financialsService = {
  // --- Lookups for Dropdowns ---
  async getJourneys() {
    const { data, error } = await supabase
      .from('journeys')
      .select('id, case_number, intended_parent_id, gestational_carrier_id, parent_id, surrogate_id');
    if (error) {
      console.error('getJourneys error:', error);
      throw error;
    }
    return data;
  },

  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, role');
    if (error) {
      console.error('getUsers error:', error);
      throw error;
    }
    return data;
  },

  // --- Benefit Packages ---
  async getBenefitPackages() {
    const { data, error } = await supabase
      .from('surrogate_benefit_packages')
      .select('*, journeys(*), users!surrogate_id(*)');
    if (error) throw error;
    return data;
  },

  async createBenefitPackage(pkg: any) {
    const { data, error } = await supabase
      .from('surrogate_benefit_packages')
      .insert([cleanUuids(pkg)])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBenefitPackage(id: string, updates: any) {
    const { data, error } = await supabase
      .from('surrogate_benefit_packages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async sendPackageForSignature(id: string) {
    // 1. Update status to 'sent'
    const { data, error } = await supabase
      .from('surrogate_benefit_packages')
      .update({ status: 'sent' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // 2. Trigger notification by inserting into the notifications table
    if (data.surrogate_id) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: data.surrogate_id,
        title: 'New Care Package to Sign',
        message: 'Your Surrogate Benefit Care Package has been finalized and is ready for your signature.',
        type: 'action_required'
      });
      if (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      // Push notification to the surrogate.
      void pushService.send(
        [data.surrogate_id],
        'New Care Package to Sign',
        'Your Surrogate Benefit Care Package is ready for your review and signature.',
        { type: 'benefit_package', packageId: id },
      );
    }

    console.log(`Package ${id} marked as sent. Notification dispatched.`);
    return data;
  },

  // --- Trust Accounts ---
  async getTrustAccounts() {
    const { data, error } = await supabase
      .from('trust_accounts')
      .select('*, journeys(*), users!intended_parent_id(*)');
    if (error) throw error;
    return data;
  },

  // Current trust balance for a journey (0 if no account yet).
  async getTrustBalance(journeyId: string): Promise<number> {
    if (!journeyId) return 0;
    const { data } = await supabase
      .from('trust_accounts')
      .select('current_balance')
      .eq('journey_id', journeyId)
      .maybeSingle();
    return data ? Number(data.current_balance) : 0;
  },

  // Deduct a surrogate payment/reimbursement/compensation from the IP's trust
  // account for the journey. Throws if the balance is $0 or insufficient, so a
  // payment can never be marked paid without funds. Records a ledger entry.
  async deductFromTrust(
    journeyId: string,
    amount: number,
    title: string,
    userId?: string | null,
  ): Promise<void> {
    if (!journeyId) {
      throw new Error('This payment is not linked to a journey, so it cannot be deducted from a trust account.');
    }
    const { data: account, error } = await supabase
      .from('trust_accounts')
      .select('id, current_balance')
      .eq('journey_id', journeyId)
      .maybeSingle();
    if (error) throw error;
    if (!account) {
      throw new Error('No trust account exists for this journey. Fund the Intended Parent trust account before paying the surrogate.');
    }
    const balance = Number(account.current_balance);
    if (balance <= 0) {
      throw new Error('The Intended Parent trust account balance is $0. Fund the trust account before marking any surrogate payment as paid.');
    }
    if (amount > balance) {
      throw new Error(`Insufficient trust balance ($${balance.toFixed(2)}) to pay $${Number(amount).toFixed(2)}. Fund the trust account first.`);
    }
    const { error: updErr } = await supabase
      .from('trust_accounts')
      .update({ current_balance: balance - amount })
      .eq('id', account.id);
    if (updErr) throw updErr;

    await supabase.from('payment_schedules').insert({
      user_id: userId ?? null,
      amount: -Math.abs(amount),
      type: 'Disbursement',
      title,
      status: 'PAID',
      date_of_occurrence: new Date().toISOString().split('T')[0],
      is_recurring: false,
    });
  },

  async addFunds(journeyId: string, amount: number) {
    // Basic implementation: fetch current, add amount, update
    const { data: account, error: fetchErr } = await supabase
      .from('trust_accounts')
      .select('id, total_funded, current_balance')
      .eq('journey_id', journeyId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    if (!account) {
      // Fetch journey to get required fields
      const { data: journey, error: journeyErr } = await supabase
        .from('journeys')
        .select('parent_id')
        .eq('id', journeyId)
        .single();
      if (journeyErr) throw journeyErr;

      // Create new trust account
      const { data, error } = await supabase
        .from('trust_accounts')
        .insert({
          journey_id: journeyId,
          intended_parent_id: journey.parent_id,
          total_funded: amount,
          current_balance: amount
        })
        .select()
        .single();
      if (error) throw error;

      // Create ledger entry as a deposit transaction
      await supabase.from('payment_schedules').insert({
        user_id: journey.surrogate_id || journey.parent_id || null,
        amount: amount,
        type: 'Deposit',
        title: 'Initial Trust Account Funding',
        status: 'PAID',
        date_of_occurrence: new Date().toISOString().split('T')[0],
        is_recurring: false
      });

      return data;
    }

    const { data, error } = await supabase
      .from('trust_accounts')
      .update({
        total_funded: Number(account.total_funded) + amount,
        current_balance: Number(account.current_balance) + amount
      })
      .eq('id', account.id)
      .select()
      .single();
    if (error) throw error;

    // Fetch journey for user IDs
    const { data: j } = await supabase.from('journeys').select('surrogate_id, parent_id').eq('id', journeyId).single();
    
    // Create ledger entry as a deposit transaction
    await supabase.from('payment_schedules').insert({
      user_id: j?.surrogate_id || j?.parent_id || null,
      amount: amount,
      type: 'Deposit',
      title: 'Funds Added to Trust Account',
      status: 'PAID',
      date_of_occurrence: new Date().toISOString().split('T')[0],
      is_recurring: false
    });

    return data;
  },

  // --- Payment Schedules ---
  async getLedgerEntries(journeyId: string) {
    const { data: j } = await supabase.from('journeys').select('surrogate_id, parent_id').eq('id', journeyId).single();
    const userIds = [j?.surrogate_id, j?.parent_id].filter(Boolean);
    
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('payment_schedules')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  },

  async getPaymentSchedules() {
    const { data, error } = await supabase
      .from('payment_schedules')
      .select('*, users(*)');
    if (error) throw error;
    return data;
  },

  async createPaymentSchedule(sched: any) {
    const { data, error } = await supabase
      .from('payment_schedules')
      .insert([cleanUuids(sched)])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePaymentScheduleStatus(id: string, status: 'PENDING' | 'PAID') {
    const { data, error } = await supabase
      .from('payment_schedules')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Monthly Payment Forms ---
  async getMonthlyPaymentForms() {
    const { data, error } = await supabase
      .from('monthly_payment_forms')
      .select('*, users!surrogate_id(*)');
    if (error) throw error;
    return data;
  },

  async updateMonthlyFormStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('monthly_payment_forms')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- IP Invoices ---
  async getIpInvoices() {
    const { data, error } = await supabase
      .from('ip_invoices')
      .select('*, journeys(*), users!intended_parent_id(*)');
    if (error) throw error;
    return data;
  },

  async createIpInvoice(invoice: any) {
    const { data, error } = await supabase
      .from('ip_invoices')
      .insert([cleanUuids(invoice)])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markInvoicePaid(id: string) {
    // Fetch invoice
    const { data: invoice, error: fetchErr } = await supabase
      .from('ip_invoices')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // Update status
    const { data, error } = await supabase
      .from('ip_invoices')
      .update({ status: 'PAID', paid_date: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Top up trust account
    await financialsService.addFunds(invoice.journey_id, invoice.trust_account_allocation);
    
    return data;
  }
};
