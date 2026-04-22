import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
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
  'Medical – Copay', 'Medical – Prescription', 'Lost Wages', 'Childcare', 'Other',
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
    category: 'Travel – Air',
    status: 'Submitted',
    submittedDate: new Date().toISOString().split('T')[0],
    incurredDate: new Date().toISOString().split('T')[0],
  });

  // MTD/YTD
  const [mtdYtd, setMtdYtd] = useState({ mtdRevenue: 0, ytdRevenue: 0, mtdExpenses: 0, ytdExpenses: 0 });

  // Pipeline stages (per-IP tracking — stored as JSONB in users table, keyed by IP id)
  const [pipelineIpId, setPipelineIpId] = useState('');
  const [pipelineStage, setPipelineStage] = useState<string>('Inquiry Received');
  const [pipelineSaved, setPipelineSaved] = useState(false);

  // Agency fee satisfied check
  const [feeSatisfiedIpId, setFeeSatisfiedIpId] = useState('');
  const [feeSatisfiedResult, setFeeSatisfiedResult] = useState<boolean | null>(null);

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

      const agencyFees = data.filter(t => t.category === 'Agency Fee' && t.reference?.startsWith('installment:'));
      const mapped: AgencyFeeInstallment[] = agencyFees.map(t => ({
        id: t.id,
        intendedParentId: (t as any).intendedParentId || (t as any).intended_parent_id || '',
        installmentNumber: parseInt(t.reference!.replace('installment:', ''), 10),
        totalInstallments: 0,
        amount: t.amount,
        dueDate: t.date,
        paidDate: t.status === 'Completed' ? t.date : undefined,
        status: t.status === 'Completed' ? 'Paid' : t.status === 'Cancelled' ? 'Waived' : new Date(t.date) < new Date() ? 'Overdue' : 'Pending',
        notes: t.description,
        createdAt: t.createdAt,
      }));
      setInstallments(mapped);
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSummary = (data: AgencyTransaction[]) => {
    const totalRevenue = data.filter(t => t.type === 'Revenue' && t.status === 'Completed').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = data.filter(t => t.type === 'Expense' && t.status === 'Completed').reduce((s, t) => s + t.amount, 0);
    const pendingRevenue = data.filter(t => t.type === 'Revenue' && t.status === 'Pending').reduce((s, t) => s + t.amount, 0);
    setSummary({ totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses, pendingRevenue });
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description || !newTransaction.category) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      await agencyService.addTransaction({ ...newTransaction as any, createdBy: user?.id, createdAt: new Date().toISOString() });
      setShowAddModal(false);
      fetchData();
      setNewTransaction({ type: 'Revenue', status: 'Completed', date: new Date().toISOString().split('T')[0] });
    } catch {
      alert('Failed to add transaction');
    }
  };

  const handleAddReimbursable = async () => {
    if (!newReimbursable.journeyId?.trim() || !newReimbursable.amount || !newReimbursable.description) {
      alert('Journey ID, amount, and description are required');
      return;
    }
    try {
      await reimbursableService.addReimbursable({ ...newReimbursable as any, createdBy: user?.id || 'admin' });
      setShowAddReimbursable(false);
      setNewReimbursable({ category: 'Travel – Air', status: 'Submitted', submittedDate: new Date().toISOString().split('T')[0], incurredDate: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch {
      alert('Failed to add reimbursable');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { Completed: 'green', Pending: 'yellow', Cancelled: 'red', Waived: 'gray' };
    return <Badge color={(colors[status] || 'gray') as any}>{status}</Badge>;
  };

  const reimbursableStatusColor = (s: ReimbursableStatus): any => ({
    Reimbursed: 'green', Approved: 'blue', 'Partially Approved': 'yellow',
    'Under Review': 'yellow', Submitted: 'gray', Denied: 'red',
  })[s] || 'gray';

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {!canViewFinancials(profile?.role) ? (
            // Case Manager: only see non-financial agency fee satisfied indicator
            <div className="max-w-md mx-auto mt-16">
              <Card className="p-6 text-center">
                <i className="ri-shield-check-line text-4xl text-blue-400 mb-3 block"></i>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Agency Fee Status Check</h2>
                <p className="text-sm text-gray-500 mb-4">Check whether agency fee requirements are satisfied for an Intended Parent (no dollar amounts shown).</p>
                <div className="flex gap-2">
                  <input
                    value={feeSatisfiedIpId}
                    onChange={e => setFeeSatisfiedIpId(e.target.value)}
                    placeholder="Intended Parent ID"
                    className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-2 text-sm"
                  />
                  <Button size="sm" onClick={async () => {
                    if (!feeSatisfiedIpId.trim()) return;
                    const result = await agencyService.isAgencyFeeSatisfied(feeSatisfiedIpId.trim());
                    setFeeSatisfiedResult(result);
                  }}>Check</Button>
                </div>
                {feeSatisfiedResult !== null && (
                  <div className={`mt-4 rounded-xl p-4 text-sm font-semibold ${feeSatisfiedResult ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    Agency Fee Requirements: {feeSatisfiedResult ? 'Satisfied' : 'Not Satisfied'}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agency Financials</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track revenue, expenses, reimbursables, and agency fees.</p>
                </div>
                <Button color="blue" onClick={() => setShowAddModal(true)}>
                  <i className="ri-add-line mr-2"></i>Add Transaction
                </Button>
              </div>

              {/* Summary Cards — with MTD/YTD */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Revenue', sub: `MTD: ${formatCurrency(mtdYtd.mtdRevenue)} · YTD: ${formatCurrency(mtdYtd.ytdRevenue)}`, value: summary.totalRevenue, color: 'border-green-500', iconBg: 'bg-green-100 dark:bg-green-900/30', icon: 'ri-arrow-up-circle-line text-green-600 dark:text-green-400' },
                  { label: 'Total Expenses', sub: `MTD: ${formatCurrency(mtdYtd.mtdExpenses)} · YTD: ${formatCurrency(mtdYtd.ytdExpenses)}`, value: summary.totalExpenses, color: 'border-red-500', iconBg: 'bg-red-100 dark:bg-red-900/30', icon: 'ri-arrow-down-circle-line text-red-600 dark:text-red-400' },
                  { label: 'Net Income', sub: 'Completed revenue minus expenses', value: summary.netIncome, color: 'border-blue-500', iconBg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'ri-wallet-3-line text-rose-500 dark:text-rose-400' },
                  { label: 'Pending Revenue', sub: 'Awaiting collection', value: summary.pendingRevenue, color: 'border-yellow-500', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'ri-time-line text-yellow-600 dark:text-yellow-400' },
                ].map(c => (
                  <Card key={c.label} className={`p-5 border-l-4 ${c.color}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-gray-500">{c.label}</p>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(c.value)}</h3>
                        <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                      </div>
                      <div className={`p-2 ${c.iconBg} rounded-lg`}><i className={`${c.icon} text-xl`}></i></div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Agency Fee Satisfied Indicator for this admin user too */}
              <Card className="p-4 mb-6 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agency Fee Satisfied check:</span>
                <input
                  value={feeSatisfiedIpId}
                  onChange={e => setFeeSatisfiedIpId(e.target.value)}
                  placeholder="Intended Parent ID"
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm w-64"
                />
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!feeSatisfiedIpId.trim()) return;
                  const result = await agencyService.isAgencyFeeSatisfied(feeSatisfiedIpId.trim());
                  setFeeSatisfiedResult(result);
                }}>Check</Button>
                {feeSatisfiedResult !== null && (
                  <Badge color={feeSatisfiedResult ? 'green' : 'red'}>
                    {feeSatisfiedResult ? 'Satisfied' : 'Not Satisfied'}
                  </Badge>
                )}
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-200 dark:border-white/5 mb-6 overflow-x-auto no-scrollbar">
                {(['overview', 'installments', 'reimbursables', 'pipeline', 'transactions'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === t ? 'border-rose-500 text-rose-600 dark:text-rose-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Overview: Aging Report */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <Card className="overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-white/5">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Outstanding Reimbursables — Aging Report</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Based on submitted date of non-reimbursed, non-denied reimbursables.</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100 dark:divide-white/5">
                      {agingReport.map(b => (
                        <div key={b.bucket} className="p-5">
                          <p className="text-xs text-gray-500 font-medium">{b.bucket}</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(b.totalAmount)}</p>
                          <p className="text-xs text-gray-400 mt-1">{b.count} item{b.count !== 1 ? 's' : ''}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Agency Fee Installments */}
              {activeTab === 'installments' && (
                <Card className="overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Agency Fee Installments</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Per-IP schedules. Separate from escrow and surrogate compensation.</p>
                    </div>
                    {hasPermission(profile?.role, 'view_fee_amounts') && (
                      <Button size="sm" onClick={() => setShowInstallmentForm(v => !v)}>
                        <i className="ri-add-line mr-1"></i>New Schedule
                      </Button>
                    )}
                  </div>

                  {showInstallmentForm && (
                    <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Intended Parent ID</label>
                        <input value={installmentIpId} onChange={e => setInstallmentIpId(e.target.value)} placeholder="IP user ID" className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm" />
                      </div>
                      <div className="space-y-2">
                        {installmentRows.map((row, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-xs text-gray-500 w-6">#{i+1}</span>
                            <input type="number" placeholder="Amount ($)" value={row.amount} onChange={e => setInstallmentRows(r => r.map((x, j) => j === i ? {...x, amount: e.target.value} : x))} className="w-28 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1 text-sm" />
                            <input type="date" value={row.dueDate} onChange={e => setInstallmentRows(r => r.map((x, j) => j === i ? {...x, dueDate: e.target.value} : x))} className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1 text-sm" />
                            <input type="text" placeholder="Notes (optional)" value={row.notes} onChange={e => setInstallmentRows(r => r.map((x, j) => j === i ? {...x, notes: e.target.value} : x))} className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1 text-sm" />
                            {installmentRows.length > 1 && <button onClick={() => setInstallmentRows(r => r.filter((_, j) => j !== i))} className="text-red-400 text-xs"><i className="ri-delete-bin-line"></i></button>}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setInstallmentRows(r => [...r, { amount: '', dueDate: '', notes: '' }])}>+ Add Row</Button>
                        <Button size="sm" onClick={async () => {
                          if (!installmentIpId.trim()) return alert('IP ID required');
                          await agencyService.createInstallmentSchedule(installmentIpId, installmentRows.map(r => ({ amount: parseFloat(r.amount), dueDate: r.dueDate, notes: r.notes })));
                          setShowInstallmentForm(false);
                          setInstallmentIpId('');
                          setInstallmentRows([{ amount: '', dueDate: '', notes: '' }]);
                          fetchData();
                        }}>Save Schedule</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowInstallmentForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    {installments.length === 0 ? (
                      <p className="p-6 text-sm text-gray-400 italic">No installment schedules yet.</p>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-[#15111f] text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-4 py-3">IP</th>
                            <th className="px-4 py-3">Installment</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Due Date</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installments.map(inst => {
                            const c: any = { Paid: 'green', Pending: 'yellow', Overdue: 'red', Waived: 'gray' }[inst.status] || 'gray';
                            return (
                              <tr key={inst.id} className="border-t border-gray-100 dark:border-white/5">
                                <td className="px-4 py-2 font-mono text-xs text-gray-500">{inst.intendedParentId?.slice(0, 8) || '—'}</td>
                                <td className="px-4 py-2">#{inst.installmentNumber}</td>
                                <td className="px-4 py-2 font-semibold">{formatCurrency(inst.amount)}</td>
                                <td className="px-4 py-2">{formatMMDDYYYY(inst.dueDate)}</td>
                                <td className="px-4 py-2"><Badge color={c}>{inst.status}</Badge></td>
                                <td className="px-4 py-2 flex gap-2">
                                  {inst.status !== 'Paid' && inst.status !== 'Waived' && (
                                    <button onClick={async () => { await agencyService.markInstallmentPaid(inst.id); fetchData(); }} className="text-xs text-green-600 hover:underline">Mark Paid</button>
                                  )}
                                  {inst.status !== 'Waived' && hasPermission(profile?.role, 'override_guardrails') && (
                                    <button onClick={async () => {
                                      const reason = window.prompt('Waiver reason (required):');
                                      if (!reason?.trim()) return;
                                      await agencyService.waiveInstallment(inst.id, reason);
                                      fetchData();
                                    }} className="text-xs text-gray-400 hover:underline">Waive</button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>
              )}

              {/* Agency Reimbursables */}
              {activeTab === 'reimbursables' && (
                <div className="space-y-6">
                  <Card className="overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Agency Reimbursables</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Tracked per Journey. Each item requires amount, category, and receipt. Separate from agency fees.</p>
                      </div>
                      <Button size="sm" onClick={() => setShowAddReimbursable(v => !v)}>
                        <i className="ri-add-line mr-1"></i>Add Reimbursable
                      </Button>
                    </div>

                    {showAddReimbursable && (
                      <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                          { label: 'Journey ID *', key: 'journeyId', type: 'text' },
                          { label: 'GC ID (optional)', key: 'gcId', type: 'text' },
                          { label: 'Category *', key: 'category', type: 'select', options: REIMBURSABLE_CATEGORIES },
                          { label: 'Amount Requested ($) *', key: 'amount', type: 'number' },
                          { label: 'Incurred Date', key: 'incurredDate', type: 'date' },
                          { label: 'Submitted Date', key: 'submittedDate', type: 'date' },
                          { label: 'Description *', key: 'description', type: 'text' },
                          { label: 'Receipt URL', key: 'receiptUrl', type: 'text' },
                          { label: 'Status', key: 'status', type: 'select', options: ['Submitted','Under Review','Approved','Partially Approved','Reimbursed','Denied'] },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                            {f.type === 'select' ? (
                              <select value={(newReimbursable as any)[f.key] || ''} onChange={e => setNewReimbursable(p => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm">
                                {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input type={f.type} value={(newReimbursable as any)[f.key] || ''} onChange={e => setNewReimbursable(p => ({ ...p, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm" />
                            )}
                          </div>
                        ))}
                        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                          <Button size="sm" onClick={handleAddReimbursable}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowAddReimbursable(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      {reimbursables.length === 0 ? (
                        <p className="p-6 text-sm text-gray-400 italic">No reimbursables yet. Add one using "Add Reimbursable".</p>
                      ) : (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 dark:bg-[#15111f] text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-4 py-3">Journey</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Description</th>
                              <th className="px-4 py-3">Requested</th>
                              <th className="px-4 py-3">Approved</th>
                              <th className="px-4 py-3">Incurred</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Receipt</th>
                              <th className="px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reimbursables.map(r => (
                              <tr key={r.id} className="border-t border-gray-100 dark:border-white/5">
                                <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.journeyId?.slice(0, 8) || '—'}</td>
                                <td className="px-4 py-2">{r.category}</td>
                                <td className="px-4 py-2 max-w-xs truncate">{r.description}</td>
                                <td className="px-4 py-2 font-semibold">{formatCurrency(r.amount)}</td>
                                <td className="px-4 py-2">{r.approvedAmount != null ? formatCurrency(r.approvedAmount) : '—'}</td>
                                <td className="px-4 py-2">{formatMMDDYYYY(r.incurredDate)}</td>
                                <td className="px-4 py-2"><Badge color={reimbursableStatusColor(r.status)}>{r.status}</Badge></td>
                                <td className="px-4 py-2">{r.receiptUrl ? <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline">View</a> : '—'}</td>
                                <td className="px-4 py-2">
                                  <select value={r.status} onChange={async e => {
                                    const s = e.target.value as ReimbursableStatus;
                                    await reimbursableService.updateReimbursable(r.id, {
                                      status: s,
                                      reimbursedDate: s === 'Reimbursed' ? new Date().toISOString().split('T')[0] : r.reimbursedDate,
                                    });
                                    fetchData();
                                  }} className="text-xs rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-2 py-1">
                                    {['Submitted','Under Review','Approved','Partially Approved','Reimbursed','Denied'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                  {hasPermission(profile?.role, 'override_guardrails') && (
                                    <button onClick={async () => {
                                      if (!window.confirm('Delete this reimbursable?')) return;
                                      await reimbursableService.deleteReimbursable(r.id);
                                      fetchData();
                                    }} className="ml-2 text-red-400 hover:text-red-600 text-xs"><i className="ri-delete-bin-line"></i></button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Outstanding balance auto-calculation */}
                    {reimbursables.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 flex flex-wrap gap-6 text-sm">
                        <span><span className="font-medium text-gray-700 dark:text-gray-300">Total Submitted:</span> <span className="font-bold">{formatCurrency(reimbursables.reduce((s, r) => s + r.amount, 0))}</span></span>
                        <span><span className="font-medium text-gray-700 dark:text-gray-300">Total Reimbursed:</span> <span className="font-bold text-green-600">{formatCurrency(reimbursables.filter(r => r.status === 'Reimbursed').reduce((s, r) => s + (r.approvedAmount ?? r.amount), 0))}</span></span>
                        <span><span className="font-medium text-gray-700 dark:text-gray-300">Outstanding Balance:</span> <span className="font-bold text-rose-600">{formatCurrency(reimbursables.filter(r => r.status !== 'Reimbursed' && r.status !== 'Denied').reduce((s, r) => s + r.amount, 0))}</span></span>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Agency Pipeline Stages Tracker */}
              {activeTab === 'pipeline' && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Agency Pipeline Stage Tracker</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Track each IP case through the 11-stage pipeline. Stage is saved to the IP's user record.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={pipelineIpId}
                      onChange={e => { setPipelineIpId(e.target.value); setPipelineSaved(false); }}
                      placeholder="Intended Parent ID"
                      className="flex-1 max-w-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm"
                    />
                    <select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)} className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#15111f] px-3 py-1.5 text-sm">
                      {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Button size="sm" onClick={async () => {
                      if (!pipelineIpId.trim()) return;
                      const { supabase } = await import('../../lib/supabase');
                      await supabase.from('users').update({ pipeline_stage: pipelineStage, pipeline_updated_at: new Date().toISOString() }).eq('id', pipelineIpId.trim());
                      setPipelineSaved(true);
                    }}>Save</Button>
                  </div>
                  {pipelineSaved && <p className="text-sm text-green-600">Pipeline stage saved.</p>}

                  {/* Visual pipeline */}
                  <div className="mt-4">
                    <div className="relative flex flex-wrap gap-2">
                      {PIPELINE_STAGES.map((stage, i) => {
                        const activeIdx = PIPELINE_STAGES.indexOf(pipelineStage as any);
                        const isPast = i < activeIdx;
                        const isCurrent = i === activeIdx;
                        return (
                          <button
                            key={stage}
                            onClick={() => setPipelineStage(stage)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isCurrent ? 'bg-rose-500 text-white border-rose-500 shadow-md' :
                              isPast ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' :
                              'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
                            }`}
                          >
                            {i + 1}. {stage}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {/* Transactions List */}
              {activeTab === 'transactions' && (
                <Card className="overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-white/5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">All Transactions</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs uppercase">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Date</th>
                          <th className="px-6 py-3 font-semibold">Description</th>
                          <th className="px-6 py-3 font-semibold">Category</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                          <tr><td colSpan={5} className="text-center py-6">Loading...</td></tr>
                        ) : transactions.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-6 text-gray-500">No transactions found</td></tr>
                        ) : (
                          transactions.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">{formatMMDDYYYY(t.date)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                {t.description}
                                {t.journeyId && <span className="block text-xs text-gray-500">Ref: {t.journeyId.slice(0,8)}</span>}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.type === 'Revenue' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {t.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm">{getStatusBadge(t.status)}</td>
                              <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === 'Revenue' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                {t.type === 'Revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add Transaction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <div className="flex gap-4">
                  {(['Revenue', 'Expense'] as const).map(t => (
                    <label key={t} className="flex items-center">
                      <input type="radio" name="type" value={t} checked={newTransaction.type === t} onChange={() => setNewTransaction({...newTransaction, type: t})} className="mr-2" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select className="w-full border rounded-md p-2 dark:bg-white/5 dark:border-white/10" value={newTransaction.category || ''} onChange={e => setNewTransaction({...newTransaction, category: e.target.value as any})}>
                  <option value="">Select Category</option>
                  {['Agency Fee','Legal Fee','Medical Fee','Screening Fee','Travel','Allowance','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                <input type="number" className="w-full border rounded-md p-2 dark:bg-white/5 dark:border-white/10" value={newTransaction.amount || ''} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="date" className="w-full border rounded-md p-2 dark:bg-white/5 dark:border-white/10" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" className="w-full border rounded-md p-2 dark:bg-white/5 dark:border-white/10" value={newTransaction.description || ''} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} placeholder="Transaction details..." />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button color="blue" onClick={handleAddTransaction}>Save Transaction</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsPage;
