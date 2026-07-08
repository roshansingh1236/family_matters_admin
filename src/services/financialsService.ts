import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase'; // Assuming there is a types file, if not we'll use any

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
      .insert([pkg])
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
      .insert([sched])
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
      .insert([invoice])
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
