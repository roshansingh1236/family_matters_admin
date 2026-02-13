
import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { paymentService } from '../../services/paymentService';
import type { Payment } from '../../services/paymentService';
import MedicalRecordModal from '../../components/feature/MedicalRecordModal';
import UserSelector from '../../components/feature/UserSelector';

const PaymentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Payment>>({
    surrogateId: '',
    surrogateName: '',
    amount: 0,
    type: 'Base Compensation',
    status: 'Scheduled',
    dueDate: '',
    description: '',
    notes: ''
  });

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const data = await paymentService.getAllPayments();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const stats = {
    totalPaid: payments.filter(p => p.status === 'Paid').reduce((acc, curr) => acc + Number(curr.amount), 0),
    pending: payments.filter(p => p.status === 'Pending').reduce((acc, curr) => acc + Number(curr.amount), 0),
    upcoming: payments.filter(p => p.status === 'Scheduled').reduce((acc, curr) => acc + Number(curr.amount), 0),
    overdue: payments.filter(p => p.status === 'Overdue').reduce((acc, curr) => acc + Number(curr.amount), 0)
  };

  const statusColors = {
    Paid: 'green',
    Pending: 'yellow',
    Scheduled: 'blue',
    Overdue: 'red',
    Cancelled: 'gray',
    Rejected: 'red'
  } as const;

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
         await paymentService.updatePayment(formData.id, formData);
      } else {
         await paymentService.createPayment(formData as any);
      }
      await fetchPayments();
      setShowNewPaymentModal(false);
      setFormData({ surrogateName: '', amount: 0, type: 'Base Compensation', status: 'Scheduled', dueDate: '', description: '', notes: '' });
    } catch (error) {
      console.error(error);
    }
  };
  
  const handleDelete = async (id: string) => {
      if(!confirm("Delete this payment record?")) return;
      await paymentService.deletePayment(id);
      await fetchPayments();
      setSelectedPayment(null);
  }

  const handleEdit = (payment: Payment) => {
      setFormData(payment);
      setSelectedPayment(null);
      setShowNewPaymentModal(true);
  }

  const filteredPayments = activeTab === 'all' 
    ? payments 
    : payments.filter(p => p.status.toLowerCase() === activeTab);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Compensation</h1>
              <p className="text-gray-600 dark:text-gray-400">Track surrogate compensation and expenses.</p>
            </div>
            <Button color="blue" onClick={() => { setFormData({}); setShowNewPaymentModal(true); }}>
               <i className="ri-add-line mr-2"></i> Record Payment
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none">
              <div className="text-green-100 mb-1">Total Paid</div>
              <div className="text-3xl font-bold">${stats.totalPaid.toLocaleString()}</div>
            </Card>
            <Card className="bg-white dark:bg-gray-800">
              <div className="text-gray-500 dark:text-gray-400 mb-1">Pending Approval</div>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">${stats.pending.toLocaleString()}</div>
            </Card>
            <Card className="bg-white dark:bg-gray-800">
              <div className="text-gray-500 dark:text-gray-400 mb-1">Upcomming (Scheduled)</div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">${stats.upcoming.toLocaleString()}</div>
            </Card>
            <Card className="bg-white dark:bg-gray-800">
              <div className="text-red-500 mb-1">Overdue</div>
              <div className="text-3xl font-bold text-red-600">${stats.overdue.toLocaleString()}</div>
            </Card>
          </div>

            <div className="mb-6 flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {['all', 'paid', 'pending', 'scheduled', 'overdue'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {isLoading ? (
                  <div className="flex justify-center py-12"><i className="ri-loader-4-line text-3xl animate-spin text-blue-600"></i></div>
              ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-lg">No payments found.</div>
              ) : (
                  filteredPayments.map(payment => (
                    <Card key={payment.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedPayment(payment)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                             payment.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <i className="ri-money-dollar-circle-line text-xl"></i>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{payment.surrogateName}</h3>
                            <p className="text-sm text-gray-500">{payment.type} • {payment.dueDate}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900 dark:text-white">${Number(payment.amount).toLocaleString()}</div>
                          <Badge color={statusColors[payment.status] || 'gray'}>{payment.status}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))
              )}
            </div>

            {/* Payment Detail Modal */}
            {selectedPayment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                  <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                    <div className="flex justify-between items-start mb-6">
                      <h2 className="text-2xl font-bold dark:text-white">Payment Details</h2>
                      <button onClick={() => setSelectedPayment(null)}><i className="ri-close-line text-2xl text-gray-500"></i></button>
                    </div>

                    <div className="space-y-4 mb-6">
                       <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400">Recipient</span>
                          <span className="font-medium dark:text-white">{selectedPayment.surrogateName}</span>
                       </div>
                       <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400">Amount</span>
                          <span className="font-bold text-xl text-green-600">${Number(selectedPayment.amount).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400">Type</span>
                          <span className="font-medium dark:text-white">{selectedPayment.type}</span>
                       </div>
                       <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400">Status</span>
                          <Badge color={statusColors[selectedPayment.status]}>{selectedPayment.status}</Badge>
                       </div>
                       <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400">Due Date</span>
                          <span className="font-medium dark:text-white">{selectedPayment.dueDate}</span>
                       </div>
                       {selectedPayment.paidDate && (
                           <div className="flex justify-between border-b dark:border-gray-700 pb-2">
                              <span className="text-gray-600 dark:text-gray-400">Paid Date</span>
                              <span className="font-medium dark:text-white">{selectedPayment.paidDate}</span>
                           </div>
                       )}
                       {selectedPayment.notes && (
                           <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                               {selectedPayment.notes}
                           </div>
                       )}
                    </div>

                    <div className="flex gap-2">
                       <Button className="flex-1" onClick={() => handleEdit(selectedPayment)}>Edit</Button>
                       <Button variant="outline" color="red" className="flex-1" onClick={() => selectedPayment.id && handleDelete(selectedPayment.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
            )}

            {/* New/Edit Payment Modal */}
            {showNewPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                  <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
                     <h2 className="text-xl font-bold mb-4 dark:text-white">{formData.id ? 'Edit Payment' : 'New Payment'}</h2>
                     <form onSubmit={handleSavePayment} className="space-y-4">
                        <UserSelector 
                            value={formData.surrogateId || ''} 
                            onChange={id => setFormData({...formData, surrogateId: id})}
                            onSelect={user => setFormData({...formData, surrogateId: user.id, surrogateName: user.name.split(' (')[0]})}
                            label="Recipient (Surrogate or Parent)"
                            required
                        />
                        
                        <div className="pt-1">
                            <button 
                                type="button"
                                onClick={() => setShowMedicalModal(true)}
                                className="w-full py-2 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="ri-health-book-line"></i>
                                Associated Medical Record
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <input 
                                type="number" 
                                placeholder="Amount" 
                                required 
                                className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData.amount} 
                                onChange={e => setFormData({...formData, amount: Number(e.target.value)})} 
                            />
                            <select 
                                className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData.type} 
                                onChange={e => setFormData({...formData, type: e.target.value as any})}
                            >
                                <option>Base Compensation</option>
                                <option>Allowance</option>
                                <option>Medical</option>
                                <option>Travel</option>
                                <option>Clothing</option>
                                <option>Legal</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs text-gray-500">Due Date</label>
                               <input 
                                    type="date" 
                                    required 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.dueDate} 
                                    onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                                />
                           </div>
                           <div>
                               <label className="text-xs text-gray-500">Status</label>
                               <select 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.status} 
                                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                                >
                                    <option>Scheduled</option>
                                    <option>Pending</option>
                                    <option>Paid</option>
                                    <option>Overdue</option>
                                    <option>Cancelled</option>
                                </select>
                           </div>
                        </div>
                        {formData.status === 'Paid' && (
                             <div>
                                <label className="text-xs text-gray-500">Paid Date</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.paidDate || ''} 
                                    onChange={e => setFormData({...formData, paidDate: e.target.value})} 
                                />
                            </div>
                        )}
                        <textarea 
                            placeholder="Description / Notes" 
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                            rows={3}
                            value={formData.notes || ''} 
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                        ></textarea>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="outline" onClick={() => setShowNewPaymentModal(false)}>Cancel</Button>
                            <Button type="submit" color="blue">Save Record</Button>
                        </div>
                     </form>
                  </div>
                </div>
            )}

            <MedicalRecordModal 
               isOpen={showMedicalModal}
               onClose={() => setShowMedicalModal(false)}
            />
        </main>
      </div>
    </div>
  );
};

export default PaymentsPage;
