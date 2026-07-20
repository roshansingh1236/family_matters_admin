import React, { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import { supabase } from '../../../lib/supabase';
import { formatMMDDYYYY } from '../../../utils/dateFormat';
import { financialsService } from '../../../services/financialsService';

export const ReimbursablesManager: React.FC = () => {
  const [reimbursables, setReimbursables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReimbursables();
  }, []);

  const loadReimbursables = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_reimbursables')
        .select('*, users:gc_id(first_name, last_name)')
        .order('submitted_date', { ascending: false });
      
      if (error) throw error;
      setReimbursables(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      if (status === 'Reimbursed') {
        await financialsService.markReimbursementPaid(id);
      } else {
        const { error } = await supabase
          .from('agency_reimbursables')
          .update({ status })
          .eq('id', id);
          
        if (error) throw error;
      }
      loadReimbursables();
    } catch (e) {
      console.error(e);
      alert('Error updating status: ' + (e as Error).message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Expense Reimbursements</h2>
      </div>

      {reimbursables.length === 0 ? (
        <p className="text-gray-500">No reimbursables found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">Surrogate</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Category</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Amount</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Date</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reimbursables.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    {r.users?.first_name} {r.users?.last_name}
                  </td>
                  <td className="py-3 px-4">
                    {r.category}
                    {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                  </td>
                  <td className="py-3 px-4">${r.amount}</td>
                  <td className="py-3 px-4">{formatMMDDYYYY(r.incurred_date)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      r.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      r.status === 'Denied' ? 'bg-red-100 text-red-800' :
                      r.status === 'Reimbursed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {(r.status || 'Submitted').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    {r.receipt_url && (
                      <Button variant="outline" size="sm" onClick={() => window.open(r.receipt_url, '_blank')}>
                        Receipt
                      </Button>
                    )}
                    {r.status === 'Submitted' && (
                      <>
                        <Button color="green" size="sm" onClick={() => updateStatus(r.id, 'Approved')}>Approve</Button>
                        <Button color="red" size="sm" onClick={() => updateStatus(r.id, 'Denied')}>Deny</Button>
                      </>
                    )}
                    {r.status === 'Approved' && (
                      <Button color="blue" size="sm" onClick={() => updateStatus(r.id, 'Reimbursed')}>Mark Paid</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
