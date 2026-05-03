import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import PasswordProtection from '../../components/feature/PasswordProtection';
import { agencyService } from '../../services/agencyService';
import { reimbursableService } from '../../services/reimbursableService';
import { useAuth } from '../../contexts/AuthContext';
import { canViewFinancials, hasPermission } from '../../utils/permissions';
import { formatMMDDYYYY } from '../../utils/dateFormat';
import type { AgencyTransaction, AgencyFeeInstallment, AgencyReimbursable, ReimbursableCategory, ReimbursableStatus } from '../../types';

const PIPELINE_STAGES = [
  'Inquiry Received',
  'Consultation Completed',
  'Program Accepted',
  'Agency Fee Installment 1 Paid',
  'Matching in Progress',
  'Match Accepted',
  'Agency Fee Installment 2 Paid',
  'Journey Active',
  'Delivered',
  'Escrow Closure',
  'Case Completed',
] as const;

const REIMBURSABLE_CATEGORIES: ReimbursableCategory[] = [
  'Travel – Air', 'Travel – Ground', 'Lodging', 'Meals',
  'Medical – Copay', 'Medical – Prescription', 'Lost Wages', 'Childcare', 'Monthly Allowance (Non-Accountable)', 'Other',
];

const FinancialsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<AgencyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [installments, setInstallments] = useState<AgencyFeeInstallment[]>([]);
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [installmentIpId, setInstallmentIpId] = useState('');
  const [installmentRows, setInstallmentRows] = useState([{ amount: '', dueDate: '', notes: '' }]);

  // Reimbursables
  const [reimbursables, setReimbursables] = useState<AgencyReimbursable[]>([]);
  const [agingReport, setAgingReport] = useState<{ bucket: string; count: number; totalAmount: number }[]>([]);
  const [showAddReimbursable, setShowAddReimbursable] = useState(false);
  const [newReimbursable, setNewReimbursable] = useState<Partial<AgencyReimbursable>>({
    category: 'Monthly Allowance (Non-Accountable)',
    status: 'Submitted',
    submittedDate: new Date().toISOString().split('T')[0],
    incurredDate: new Date().toISOString().split('T')[0],
  });

  // MTD/YTD
  const [mtdYtd, setMtdYtd] = useState({ mtdRevenue: 0, ytdRevenue: 0, mtdExpenses: 0, ytdExpenses: 0 });

  // Pipeline stages
  const [pipelineIpId, setPipelineIpId] = useState('');
  const [pipelineStage, setPipelineStage] = useState<string>('Inquiry Received');
  const [pipelineSaved, setPipelineSaved] = useState(false);

  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    pendingRevenue: 0
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<AgencyTransaction>>({
    type: 'Revenue',
    status: 'Completed',
    date: new Date().toISOString().split('T')[0]
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'installments' | 'reimbursables' | 'pipeline' | 'transactions'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [data, reimbData, agingData, mtdData] = await Promise.all([
        agencyService.getAllTransactions(),
        reimbursableService.getAllReimbursables(),
        reimbursableService.getAgingReport(),
        agencyService.getMtdYtdSummary(),
      ]);
      setTransactions(data);
      updateSummary(data);
      setReimbursables(reimbData);
      setAgingReport(agingData);
      setMtdYtd(mtdData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSummary = (data: AgencyTransaction[]) => {
    const revenue = data.filter(t => t.type === 'Revenue' && t.status === 'Completed').reduce((sum, t) => sum + t.amount, 0);
    const expenses = data.filter(t => t.type === 'Expense' && t.status === 'Completed').reduce((sum, t) => sum + t.amount, 0);
    const pending = data.filter(t => t.type === 'Revenue' && t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0);

    setSummary({
      totalRevenue: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
      pendingRevenue: pending
    });
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description) return;
    await agencyService.createTransaction(newTransaction as any);
    fetchData();
    setShowAddModal(false);
    setNewTransaction({ type: 'Revenue', status: 'Completed', date: new Date().toISOString().split('T')[0] });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge color="green">Completed</Badge>;
      case 'Pending': return <Badge color="yellow">Pending</Badge>;
      case 'Failed': return <Badge color="red">Failed</Badge>;
      case 'Submitted': return <Badge color="blue">Submitted</Badge>;
      case 'Approved': return <Badge color="green">Approved</Badge>;
      case 'Reimbursed': return <Badge color="purple">Reimbursed</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  const handleUpdateReimbursableStatus = async (id: string, newStatus: string) => {
     await reimbursableService.updateReimbursable(id, { status: newStatus as any });
     fetchData();
  };

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <PasswordProtection menuName="financials">
          <main className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {!canViewFinancials(profile?.role) ? (
              <div className="max-w-md mx-auto mt-16 text-center">
                <Card className="p-12 border-dashed border-2">
                  <i className="ri-lock-2-line text-4xl text-rose-500 mb-4 block"></i>
                  <h2 className="text-xl font-bold">Access Restricted</h2>
                  <p className="text-gray-500 mt-2">Financial records are limited to authorized agency personnel.</p>
                </Card>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Trust & Agency Financials</h1>
                    <p className="text-sm text-gray-500 font-medium">Monthly allowances, expense reimbursements, and trust distributions.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setActiveTab('reimbursables')}>
                      <i className="ri-receipt-line mr-2"></i> Review Receipts
                    </Button>
                    <Button color="blue" onClick={() => setShowAddModal(true)}>
                      <i className="ri-add-line mr-2"></i> Record Transaction
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b dark:border-white/5 mb-8 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
                    { id: 'reimbursables', label: 'Surrogate Compensation', icon: 'ri-hand-coin-line' },
                    { id: 'transactions', label: 'Agency Ledger', icon: 'ri-exchange-dollar-line' },
                    { id: 'installments', label: 'Agency Fees', icon: 'ri-refund-2-line' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                        activeTab === tab.id ? 'border-rose-500 text-rose-500' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <i className={tab.icon}></i> {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none p-6 shadow-lg shadow-indigo-500/20">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Trust Liabilities (Total)</p>
                        <p className="text-3xl font-black">{formatCurrency(summary.pendingRevenue + 15000)}</p>
                        <div className="mt-4 text-[10px] bg-white/20 px-2 py-1 rounded-full w-fit">Pending Surrogate Claims</div>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none p-6 shadow-lg shadow-emerald-500/20">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Agency Revenue (YTD)</p>
                        <p className="text-3xl font-black">{formatCurrency(mtdYtd.ytdRevenue)}</p>
                        <div className="mt-4 text-[10px] bg-white/20 px-2 py-1 rounded-full w-fit">Completed Milestones</div>
                      </Card>
                      <Card className="bg-white dark:bg-[#15111f] p-6 shadow-sm border border-rose-100/50 dark:border-white/5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Net Cash Flow</p>
                        <p className="text-3xl font-black text-rose-500">{formatCurrency(summary.netIncome)}</p>
                        <div className="mt-4 text-[10px] text-gray-400 font-bold uppercase">Current Liquidity</div>
                      </Card>
                      <Card className="bg-white dark:bg-[#15111f] p-6 shadow-sm border border-rose-100/50 dark:border-white/5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Pending Reimbursements</p>
                        <p className="text-3xl font-black text-blue-500">{reimbursables.filter(r => r.status === 'Submitted').length}</p>
                        <div className="mt-4 text-[10px] text-gray-400 font-bold uppercase">Awaiting Review</div>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <Card className="p-6">
                          <h3 className="font-bold mb-6 flex items-center justify-between">
                             Recent Expense Claims
                             <span className="text-[10px] uppercase text-gray-400 tracking-widest">Surrogate Submissions</span>
                          </h3>
                          <div className="space-y-4">
                             {reimbursables.slice(0, 5).map(r => (
                               <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-rose-50/50 dark:border-white/5 hover:bg-rose-50/20 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                        <i className="ri-receipt-line"></i>
                                     </div>
                                     <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{r.category}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">Submitted {formatMMDDYYYY(r.submittedDate)}</p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(r.amount)}</p>
                                     <button onClick={() => setActiveTab('reimbursables')} className="text-[10px] font-bold text-rose-500 hover:underline">Review</button>
                                  </div>
                               </div>
                             ))}
                             {reimbursables.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">No pending claims.</p>}
                          </div>
                       </Card>
                       <Card className="p-6">
                          <h3 className="font-bold mb-6">Payment Aging Report</h3>
                          <div className="space-y-6">
                             {agingReport.map(bucket => (
                               <div key={bucket.bucket}>
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                     <span className="text-gray-400">{bucket.bucket}</span>
                                     <span className="text-rose-500 font-black">{formatCurrency(bucket.totalAmount)}</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                     <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full" style={{ width: `${Math.min(100, (bucket.totalAmount / 20000) * 100)}%` }}></div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </Card>
                    </div>
                  </div>
                )}

                {activeTab === 'reimbursables' && (
                  <div className="space-y-6">
                    <Card className="overflow-hidden">
                      <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-rose-50/20">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Surrogate Expense Pipeline</h3>
                        <div className="flex gap-2">
                           <Badge color="blue">Submitted: {reimbursables.filter(r => r.status === 'Submitted').length}</Badge>
                           <Badge color="green">Approved: {reimbursables.filter(r => r.status === 'Approved').length}</Badge>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                            <tr>
                              <th className="px-6 py-4">Submitted</th>
                              <th className="px-6 py-4">Category</th>
                              <th className="px-6 py-4">Description</th>
                              <th className="px-6 py-4">Receipt</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Amount</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {reimbursables.map(r => (
                              <tr key={r.id} className="hover:bg-rose-50/10 dark:hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400 font-medium">{formatMMDDYYYY(r.submittedDate)}</td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-gray-900 dark:text-white">{r.category}</div>
                                  <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">GC ID: {r.gcId?.slice(0,8)}</div>
                                </td>
                                <td className="px-6 py-4">
                                   <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{r.description || '—'}</p>
                                </td>
                                <td className="px-6 py-4">
                                   {r.receiptUrl ? (
                                     <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-500 hover:text-blue-600">
                                       <i className="ri-image-line text-xs"></i> View File
                                     </a>
                                   ) : <span className="text-[10px] text-gray-300 italic">No receipt</span>}
                                </td>
                                <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                                <td className="px-6 py-4 text-sm font-black text-right text-gray-900 dark:text-white">{formatCurrency(r.amount)}</td>
                                <td className="px-6 py-4 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      {r.status === 'Submitted' && (
                                        <>
                                          <button onClick={() => handleUpdateReimbursableStatus(r.id, 'Approved')} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Approve"><i className="ri-checkbox-circle-line"></i></button>
                                          <button onClick={() => handleUpdateReimbursableStatus(r.id, 'Denied')} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Decline"><i className="ri-close-circle-line"></i></button>
                                        </>
                                      )}
                                      {r.status === 'Approved' && (
                                         <button onClick={() => handleUpdateReimbursableStatus(r.id, 'Reimbursed')} className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-500 text-white rounded-lg shadow-sm">Mark Paid</button>
                                      )}
                                   </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                )}

                {activeTab === 'transactions' && (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-rose-50/10 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 text-xs text-gray-900 dark:text-gray-300">{formatMMDDYYYY(t.date)}</td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{t.description}</div>
                                {t.journeyId && <div className="text-[9px] text-gray-400 uppercase font-black tracking-tight">Ref: {t.journeyId.slice(0,8)}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <Badge color={t.type === 'Revenue' ? 'emerald' : 'rose'} variant="outline">{t.category}</Badge>
                              </td>
                              <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                              <td className={`px-6 py-4 text-sm font-black text-right ${t.type === 'Revenue' ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                                {t.type === 'Revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {activeTab === 'installments' && (
                   <div className="text-center py-24 bg-white/50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-rose-100/50 dark:border-white/5">
                      <i className="ri-refund-2-line text-4xl text-gray-300 mb-4 block"></i>
                      <p className="text-gray-500 font-medium text-sm">Detailed Agency Fee Installments Dashboard</p>
                   </div>
                )}
              </>
            )}
          </main>
        </PasswordProtection>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">New Financial Entry</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Entry Type</label>
                <div className="flex gap-4 bg-gray-50 dark:bg-white/5 p-2 rounded-xl">
                  {(['Revenue', 'Expense'] as const).map(t => (
                    <button key={t} onClick={() => setNewTransaction({...newTransaction, type: t})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTransaction.type === t ? 'bg-white dark:bg-white/10 shadow-sm text-rose-500' : 'text-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Category</label>
                <select className="w-full border dark:border-white/10 rounded-xl p-3 dark:bg-white/5 dark:text-white" value={newTransaction.category || ''} onChange={e => setNewTransaction({...newTransaction, category: e.target.value as any})}>
                  <option value="">Select Category</option>
                  {['Agency Fee','Legal Fee','Medical Fee','Screening Fee','Travel','Allowance','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Amount</label>
                <input type="number" className="w-full border dark:border-white/10 rounded-xl p-3 dark:bg-white/5 dark:text-white" value={newTransaction.amount || ''} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Date</label>
                <input type="date" className="w-full border dark:border-white/10 rounded-xl p-3 dark:bg-white/5 dark:text-white" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Description</label>
                <input type="text" className="w-full border dark:border-white/10 rounded-xl p-3 dark:bg-white/5 dark:text-white" value={newTransaction.description || ''} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} placeholder="Description of funds..." />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button color="blue" onClick={handleAddTransaction}>Post Entry</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsPage;
