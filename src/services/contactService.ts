import { supabase } from '../lib/supabase';

export type ContactCategory = 'Surrogates' | 'Intended Parents' | 'IVF Clinics' | 'Medical Facilities';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  category: ContactCategory;
  lastContact?: string;
  notes?: string;
  isExternal?: boolean;
}

export const contactService = {
  getContacts: async (): Promise<Contact[]> => {
    try {
      // 1. Fetch Users (Surrogates and Intended Parents)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, phone, role, form_data')
        .order('full_name');

      if (usersError) throw usersError;

      const userContacts: Contact[] = (users || []).map(u => {
        const formData = (u.form_data as any) || {};
        const address = formData.address || [formData.city, formData.state].filter(Boolean).join(', ') || 'N/A';
        const role = u.role as string;
        
        let category: ContactCategory;
        if (role === 'Intended Parent' || role === 'intendedParent') {
          category = 'Intended Parents';
        } else if (role === 'Surrogate' || role === 'gestationalCarrier') {
          category = 'Surrogates';
        } else {
          return null;
        }

        return {
          id: u.id,
          name: u.full_name || u.email || 'Unknown',
          email: u.email || 'N/A',
          phone: u.phone || formData.phone || 'N/A',
          address: address,
          category: category,
          isExternal: false
        };
      }).filter((c): c is Contact => c !== null);

      // 2. Fetch external partners (Clinics and Facilities)
      const { data: partners, error: partnersError } = await supabase
        .from('external_partners')
        .select('*')
        .order('name');

      if (partnersError) {
        console.warn('external_partners table might not exist yet, using fallback mock data');
        const fallback: Contact[] = [
          { id: 'f1', name: 'Pacific Fertility Center', category: 'IVF Clinics', email: 'info@pacificfertility.com', phone: '(415) 834-3000', address: '55 Francisco St, San Francisco, CA', isExternal: true },
          { id: 'f2', name: 'Mount Sinai Hospital', category: 'Medical Facilities', email: 'records@mountsinai.org', phone: '(212) 241-6500', address: '1468 Madison Ave, New York, NY', isExternal: true },
        ];
        return [...userContacts, ...fallback];
      }

      const externalContacts: Contact[] = (partners || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || 'N/A',
        phone: p.phone || 'N/A',
        address: p.address || 'N/A',
        category: p.category as ContactCategory,
        isExternal: true
      }));

      return [...userContacts, ...externalContacts];
    } catch (error) {
      console.error('Error in contactService.getContacts:', error);
      return [];
    }
  },

  createExternalPartner: async (partner: Partial<Contact>): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('external_partners')
        .insert({
          name: partner.name,
          category: partner.category,
          email: partner.email,
          phone: partner.phone,
          address: partner.address,
          notes: partner.notes
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating external partner:', error);
      throw error;
    }
  }
};
