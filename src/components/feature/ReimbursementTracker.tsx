import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../base/Card';
import Button from '../base/Button';
import Badge from '../base/Badge';
import Toast from '../base/Toast';

interface Reimbursement {
  id: string;
  amount: number;
  description: string;
  status: string;
  receipt_url?: string;
  submitted_at: string;
}

interface Props {
  userId: string;
  journeyId?: string;
}

export default function ReimbursementTracker({ userId, journeyId }: Props) {
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchReimbursements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Error fetching reimbursements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReimbursements();
  }, [userId]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('reimbursements')
        .update({ status, processed_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      setToast({ message: `Reimbursement ${status}`, type: 'success' });
      fetchReimbursements();
    } catch (err: any) {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return <Badge color="emerald">Approved</Badge>;
      case 'pending': return <Badge color="amber">Pending Review</Badge>;
      case 'declined': return <Badge color="red">Declined</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Financial Reimbursements</h3>
          <p className="text-xs text-gray-500 mt-1">Track and process expense requests from the mobile app.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Pending</p>
              <p className="text-xl font-black text-rose-500">
                ${items.filter(i => i.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0).toFixed(2)}
              </p>
           </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="ri-loader-4-line animate-spin text-3xl text-rose-500"></i>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
          <i className="ri-bank-card-line text-4xl text-gray-300 mb-3"></i>
          <p className="text-sm text-gray-500">No reimbursement requests found for this user.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#15111f]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {new Date(item.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                    {item.receipt_url && (
                      <a href={item.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                        <i className="ri-file-paper-2-line"></i> View Receipt
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                    ${Number(item.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button size="xs" variant="outline" color="emerald" onClick={() => updateStatus(item.id, 'Approved')}>Approve</Button>
                        <Button size="xs" variant="outline" color="red" onClick={() => updateStatus(item.id, 'Declined')}>Decline</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
