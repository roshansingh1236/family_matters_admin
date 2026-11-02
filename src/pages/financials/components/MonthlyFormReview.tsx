import React, { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import Badge from '../../../components/base/Badge';
import { financialsService } from '../../../services/financialsService';

export const MonthlyFormReview: React.FC = () => {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await financialsService.getMonthlyPaymentForms();
      setForms(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await financialsService.updateMonthlyFormStatus(id, status);
      loadForms();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Surrogate Monthly Payment Forms</h2>
      </div>

      {forms.length === 0 ? (
        <p className="text-gray-500">No monthly payment forms found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">Surrogate</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Month/Year</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Total Requested</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    {form.users?.first_name} {form.users?.last_name}
                  </td>
                  <td className="py-3 px-4">{form.month} {form.year}</td>
                  <td className="py-3 px-4">${form.total_amount_requested}</td>
                  <td className="py-3 px-4">
                    <Badge color={form.status === 'approved' ? 'green' : form.status === 'rejected' ? 'red' : form.status === 'paid' ? 'blue' : 'yellow'}>
                      {form.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <Button variant="outline" size="sm">View Receipts</Button>
                    {form.status === 'pending' && (
                      <>
                        <Button color="green" size="sm" onClick={() => handleUpdateStatus(form.id, 'approved')}>Approve</Button>
                        <Button color="red" size="sm" onClick={() => handleUpdateStatus(form.id, 'rejected')}>Reject</Button>
                      </>
                    )}
                    {form.status === 'approved' && (
                      <Button color="blue" size="sm" onClick={() => handleUpdateStatus(form.id, 'paid')}>Mark Paid</Button>
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
