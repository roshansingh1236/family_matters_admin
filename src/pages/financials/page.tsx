import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { agencyService } from '../../services/agencyService';
import { useAuth } from '../../contexts/AuthContext';
import type { AgencyTransaction } from '../../types';

const FinancialsPage: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<AgencyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    pendingRevenue: 0
  });

  // Simple Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<AgencyTransaction>>({
    type: 'Revenue',
    status: 'Completed',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await agencyService.getAllTransactions();
      setTransactions(data);
      updateSummary(data);
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSummary = (data: AgencyTransaction[]) => {
      const totalRevenue = data
        .filter(t => t.type === 'Revenue' && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = data
        .filter(t => t.type === 'Expense' && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const pendingRevenue = data
        .filter(t => t.type === 'Revenue' && t.status === 'Pending')
        .reduce((sum, t) => sum + t.amount, 0);

      setSummary({
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        pendingRevenue
      });
  };

  const handleAddTransaction = async () => {
    try {
      if (!newTransaction.amount || !newTransaction.description || !newTransaction.category) {
        alert('Please fill in all required fields');
        return;
      }

      await agencyService.addTransaction({
        ...newTransaction as any, // Type assertion for simplicity in prototype
        createdBy: user?.id, 
        createdAt: new Date().toISOString()
      });
      
      setShowAddModal(false);
      fetchData(); // Refresh
      setNewTransaction({
        type: 'Revenue',
        status: 'Completed',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge color="green">Completed</Badge>;
      case 'Pending': return <Badge color="yellow">Pending</Badge>;
      case 'Cancelled': return <Badge color="red">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Agency Financials</h1>
              <p className="text-gray-600 dark:text-gray-400">Track revenue, expenses, and agency fees.</p>
            </div>
            <Button color="blue" onClick={() => setShowAddModal(true)}>
              <i className="ri-add-line mr-2"></i>
              Add Transaction
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(summary.totalRevenue)}
                  </h3>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <i className="ri-arrow-up-circle-line text-green-600 dark:text-green-400 text-xl"></i>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-red-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(summary.totalExpenses)}
                  </h3>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <i className="ri-arrow-down-circle-line text-red-600 dark:text-red-400 text-xl"></i>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Income</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(summary.netIncome)}
                  </h3>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <i className="ri-wallet-3-line text-blue-600 dark:text-blue-400 text-xl"></i>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-yellow-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Revenue</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(summary.pendingRevenue)}
                  </h3>
                </div>
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <i className="ri-time-line text-yellow-600 dark:text-yellow-400 text-xl"></i>
                </div>
              </div>
            </Card>
          </div>

          {/* Transactions List */}
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase">
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
                    transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                          {transaction.journeyId && <span className="block text-xs text-gray-500">Ref: {transaction.journeyId.slice(0,8)}</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.type === 'Revenue' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {transaction.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${
                          transaction.type === 'Revenue' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {transaction.type === 'Revenue' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add Transaction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Revenue" 
                      checked={newTransaction.type === 'Revenue'}
                      onChange={() => setNewTransaction({...newTransaction, type: 'Revenue'})}
                      className="mr-2"
                    />
                    Revenue
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="type" 
                      value="Expense" 
                      checked={newTransaction.type === 'Expense'}
                      onChange={() => setNewTransaction({...newTransaction, type: 'Expense'})}
                      className="mr-2"
                    />
                    Expense
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select 
                  className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  value={newTransaction.category || ''}
                  onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value as any})}
                >
                  <option value="">Select Category</option>
                  <option value="Agency Fee">Agency Fee</option>
                  <option value="Legal Fee">Legal Fee</option>
                  <option value="Medical Fee">Medical Fee</option>
                  <option value="Screening Fee">Screening Fee</option>
                  <option value="Travel">Travel</option>
                  <option value="Allowance">Allowance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                <input 
                  type="number" 
                  className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  value={newTransaction.amount || ''}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input 
                  type="date" 
                  className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input 
                  type="text" 
                  className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                  value={newTransaction.description || ''}
                  onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                  placeholder="Transaction details..."
                />
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
