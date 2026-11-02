import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import PasswordProtection from '../../components/feature/PasswordProtection';
import { useAuth } from '../../contexts/AuthContext';
import { canViewFinancials } from '../../utils/permissions';
import { formatMMDDYYYY } from '../../utils/dateFormat';
import { BenefitPackageEditor } from './components/BenefitPackageEditor';
import { PaymentScheduleManager } from './components/PaymentScheduleManager';
import { TrustAccountManager } from './components/TrustAccountManager';
import { MonthlyFormReview } from './components/MonthlyFormReview';
import { IPInvoiceManager } from './components/IPInvoiceManager';
import { financialsService } from '../../services/financialsService';

import { ReimbursablesManager } from './components/ReimbursablesManager';

const FinancialsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'schedules' | 'monthly_forms' | 'reimbursables' | 'wallets' | 'invoices'>('overview');

  const [summary, setSummary] = useState({
    trustLiabilities: 0,
    agencyRevenue: 0,
    netCashFlow: 0,
    pendingFormsCount: 0,
  });

  const [recentForms, setRecentForms] = useState<any[]>([]);
  const [agingReport, setAgingReport] = useState<{ bucket: string; totalAmount: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [schedules, forms, trustAccounts] = await Promise.all([
        financialsService.getPaymentSchedules(),
        financialsService.getMonthlyPaymentForms(),
        financialsService.getTrustAccounts()
      ]);

      const trustLiabilities = forms.filter((f: any) => f.status === 'pending')
        .reduce((sum: number, f: any) => sum + Number(f.total_amount_requested), 0);
      
      const agencyRevenue = schedules.filter((s: any) => s.status === 'PAID' && s.type === 'Deposit')
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
        
      const payouts = schedules.filter((s: any) => s.status === 'PAID' && s.type === 'Compensation')
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      setSummary({
        trustLiabilities,
        agencyRevenue,
        netCashFlow: agencyRevenue - payouts,
        pendingFormsCount: forms.filter((f: any) => f.status === 'pending').length
      });

      // Sort recent forms by submitted_at desc
      const sortedForms = [...forms].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      setRecentForms(sortedForms.slice(0, 5));

      // Calculate Aging Report from PENDING schedules
      const now = new Date();
      const buckets = [
        { label: 'Current', min: 0, max: 30, amount: 0 },
        { label: '31-60 Days', min: 31, max: 60, amount: 0 },
        { label: '61-90 Days', min: 61, max: 90, amount: 0 },
        { label: '90+ Days', min: 91, max: Infinity, amount: 0 }
      ];
      
      schedules.filter((s: any) => s.status === 'PENDING').forEach((s: any) => {
        const days = Math.floor((now.getTime() - new Date(s.date_of_occurrence).getTime()) / 86400000);
        const b = buckets.find(b => days >= b.min && days <= b.max) || buckets[3];
        b.amount += Number(s.amount);
      });

      setAgingReport(buckets.map(b => ({ bucket: b.label, totalAmount: b.amount })));

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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
                    <Button color="blue" onClick={() => fetchData()}>
                      <i className="ri-refresh-line mr-2"></i> Refresh
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b dark:border-white/5 mb-8 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
                    { id: 'packages', label: 'Benefit Packages', icon: 'ri-file-list-3-line' },
                    { id: 'schedules', label: 'Payment Schedules', icon: 'ri-calendar-event-line' },
                    { id: 'monthly_forms', label: 'Monthly Forms', icon: 'ri-file-text-line' },
                    { id: 'reimbursables', label: 'Reimbursements', icon: 'ri-refund-2-line' },
                    { id: 'wallets', label: 'Parent Wallets', icon: 'ri-wallet-3-line' },
                    { id: 'invoices', label: 'IP Invoices', icon: 'ri-bill-line' },
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
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Trust Liabilities</p>
                        <p className="text-3xl font-black">{formatCurrency(summary.trustLiabilities)}</p>
                        <div className="mt-4 text-[10px] bg-white/20 px-2 py-1 rounded-full w-fit">Pending Surrogate Claims</div>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none p-6 shadow-lg shadow-emerald-500/20">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Agency Revenue (YTD)</p>
                        <p className="text-3xl font-black">{formatCurrency(summary.agencyRevenue)}</p>
                        <div className="mt-4 text-[10px] bg-white/20 px-2 py-1 rounded-full w-fit">Total Deposits</div>
                      </Card>
                      <Card className="bg-white dark:bg-[#15111f] p-6 shadow-sm border border-rose-100/50 dark:border-white/5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Net Cash Flow</p>
                        <p className="text-3xl font-black text-rose-500">{formatCurrency(summary.netCashFlow)}</p>
                        <div className="mt-4 text-[10px] text-gray-400 font-bold uppercase">Deposits vs Payouts</div>
                      </Card>
                      <Card className="bg-white dark:bg-[#15111f] p-6 shadow-sm border border-rose-100/50 dark:border-white/5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Pending Claims</p>
                        <p className="text-3xl font-black text-blue-500">{summary.pendingFormsCount}</p>
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
                             {recentForms.map(f => (
                               <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-rose-50/50 dark:border-white/5 hover:bg-rose-50/20 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                        <i className="ri-receipt-line"></i>
                                     </div>
                                     <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{f.month} {f.year}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">Submitted {formatMMDDYYYY(f.submitted_at)}</p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(f.total_amount_requested)}</p>
                                     <button onClick={() => setActiveTab('monthly_forms')} className="text-[10px] font-bold text-rose-500 hover:underline">Review</button>
                                  </div>
                               </div>
                             ))}
                             {recentForms.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">No pending claims.</p>}
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
                                     <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full" style={{ width: `${Math.min(100, (bucket.totalAmount / (Math.max(...agingReport.map(b => b.totalAmount), 1))) * 100)}%` }}></div>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </Card>
                    </div>
                  </div>
                )}
                
                {activeTab === 'packages' && <BenefitPackageEditor />}
                {activeTab === 'schedules' && <PaymentScheduleManager />}
                {activeTab === 'monthly_forms' && <MonthlyFormReview />}
                {activeTab === 'reimbursables' && <ReimbursablesManager />}
                {activeTab === 'wallets' && <TrustAccountManager />}
                {activeTab === 'invoices' && <IPInvoiceManager />}

              </>
            )}
          </main>
        </PasswordProtection>
      </div>
    </div>
  );
};

export default FinancialsPage;
