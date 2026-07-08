import React, { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import Badge from '../../../components/base/Badge';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';

export const PaymentScheduleManager: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    journey_id: '',
    user_id: '',
    type: 'Compensation',
    title: '',
    date_of_occurrence: new Date().toISOString().split('T')[0],
    amount: 0,
    is_recurring: false,
    recurrence_interval: 'monthly',
    recurrence_end_date: ''
  });

  useEffect(() => {
    loadSchedules();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const jData = await financialsService.getJourneys();
      const uData = await financialsService.getUsers();
      setJourneys(jData || []);
      setUsers(uData || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSchedules = async () => {
    try {
      const data = await financialsService.getPaymentSchedules();
      setSchedules(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await financialsService.updatePaymentScheduleStatus(id, 'PAID');
      loadSchedules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.is_recurring) {
        // Generate multiple schedules based on recurrence
        const startDate = new Date(formData.date_of_occurrence);
        const endDate = formData.recurrence_end_date ? new Date(formData.recurrence_end_date) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate()); // Default 1 year
        let current = new Date(startDate);
        
        while (current <= endDate) {
          const payload = {
            journey_id: formData.journey_id,
            user_id: formData.user_id,
            type: formData.type,
            title: formData.title,
            amount: formData.amount,
            date_of_occurrence: current.toISOString().split('T')[0],
            is_recurring: true,
            recurrence_interval: formData.recurrence_interval,
            status: 'PENDING'
          };
          await financialsService.createPaymentSchedule(payload);
          
          if (formData.recurrence_interval === 'monthly') {
            current.setMonth(current.getMonth() + 1);
          } else if (formData.recurrence_interval === 'weekly') {
            current.setDate(current.getDate() + 7);
          } else {
            break; // Fallback
          }
        }
      } else {
        await financialsService.createPaymentSchedule({
            journey_id: formData.journey_id,
            user_id: formData.user_id,
            type: formData.type,
            title: formData.title,
            amount: formData.amount,
            date_of_occurrence: formData.date_of_occurrence,
            is_recurring: false,
            status: 'PENDING'
        });
      }
      setShowModal(false);
      loadSchedules();
    } catch (e) {
      console.error(e);
      alert('Error adding schedule. Check console.');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Payment Schedules & SPC Calendar</h2>
        <Button color="blue" onClick={() => setShowModal(true)}>
          <i className="ri-add-line mr-2"></i> Add Scheduled Payment
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Add Scheduled Payment</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Journey ID</label>
                <SearchableDropdown
                  options={journeys.map(j => ({ id: j.id, name: j.case_number || `Journey ${j.id.substring(0, 8)}` }))}
                  value={formData.journey_id}
                  onChange={val => {
                    const selectedJourney = journeys.find(j => j.id === val);
                    const isIP = formData.type === 'Deposit';
                    console.log('Selected Journey in PaymentScheduleManager:', selectedJourney);
                    console.log('Auto-populating user for Type:', formData.type);
                    setFormData({ 
                      ...formData, 
                      journey_id: val,
                      user_id: isIP ? (selectedJourney?.intended_parent_id || selectedJourney?.parent_id || '') : (selectedJourney?.gestational_carrier_id || selectedJourney?.surrogate_id || '')
                    });
                  }}
                  placeholder="Select Journey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <SearchableDropdown
                  options={users
                    .filter(u => {
                      if (!formData.journey_id) return true;
                      const j = journeys.find(jx => jx.id === formData.journey_id);
                      if (!j) return true;
                      if (formData.type === 'Deposit') return u.id === (j.intended_parent_id || j.parent_id);
                      return u.id === (j.gestational_carrier_id || j.surrogate_id);
                    })
                    .map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name} (${u.role})` }))}
                  value={formData.user_id}
                  onChange={val => setFormData({ ...formData, user_id: val })}
                  placeholder="Select User"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border rounded p-2 text-black" 
                  value={formData.type} onChange={e => {
                    const selectedJourney = journeys.find(j => j.id === formData.journey_id);
                    const isIP = e.target.value === 'Deposit';
                    setFormData({
                      ...formData, 
                      type: e.target.value,
                      user_id: selectedJourney ? (isIP ? (selectedJourney.intended_parent_id || selectedJourney.parent_id || '') : (selectedJourney.gestational_carrier_id || selectedJourney.surrogate_id || '')) : formData.user_id
                    });
                  }}>
                  <option value="Compensation">Compensation (Surrogate)</option>
                  <option value="Deposit">Deposit (IP)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input type="text" required className="w-full border rounded p-2 text-black" 
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" required className="w-full border rounded p-2 text-black" 
                  value={formData.date_of_occurrence} onChange={e => setFormData({...formData, date_of_occurrence: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount ($)</label>
                <input type="number" required className="w-full border rounded p-2 text-black" 
                  value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_recurring" 
                  checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} />
                <label htmlFor="is_recurring" className="text-sm font-medium">Recurring Payment?</label>
              </div>
              {formData.is_recurring && (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                   <div>
                     <label className="block text-sm font-medium mb-1 text-black">Interval</label>
                     <select className="w-full border rounded p-2 text-black" 
                       value={formData.recurrence_interval} onChange={e => setFormData({...formData, recurrence_interval: e.target.value})}>
                       <option value="monthly">Monthly</option>
                       <option value="weekly">Weekly</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium mb-1 text-black">End Date</label>
                     <input type="date" className="w-full border rounded p-2 text-black" 
                       value={formData.recurrence_end_date} onChange={e => setFormData({...formData, recurrence_end_date: e.target.value})} />
                   </div>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button color="blue" type="submit">Add Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <p className="text-gray-500">No scheduled payments found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">User</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Type</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Title</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Date</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Amount</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Recurring</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((sched) => (
                <tr key={sched.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    {sched.users?.first_name} {sched.users?.last_name}
                  </td>
                  <td className="py-3 px-4">{sched.type}</td>
                  <td className="py-3 px-4">{sched.title}</td>
                  <td className="py-3 px-4">{new Date(sched.date_of_occurrence).toLocaleDateString()}</td>
                  <td className="py-3 px-4">${sched.amount}</td>
                  <td className="py-3 px-4">
                     {sched.is_recurring ? <span className="text-xs font-bold text-blue-500">{sched.recurrence_interval}</span> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge color={sched.status === 'PAID' ? 'green' : 'yellow'}>{sched.status}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {sched.status === 'PENDING' && (
                      <Button variant="outline" size="sm" onClick={() => handleMarkPaid(sched.id)}>
                        Mark Paid
                      </Button>
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
