import React, { useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

// Mock payments data
const payments = [
  {
    id: 'PAY001',
    type: 'compensation',
    amount: 25000,
    currency: 'USD',
    status: 'completed',
    date: '2024-01-15',
    dueDate: '2024-01-15',
    surrogate: 'Emma Thompson',
    parents: 'John & Mary Davis',
    description: 'Base compensation payment',
    method: 'Bank Transfer',
    reference: 'TXN-2024-001'
  },
  {
    id: 'PAY002',
    type: 'medical',
    amount: 3500,
    currency: 'USD',
    status: 'pending',
    date: '2024-01-16',
    dueDate: '2024-01-20',
    surrogate: 'Lisa Rodriguez',
    parents: 'Robert & Susan Miller',
    description: 'Medical expenses reimbursement',
    method: 'Check',
    reference: 'TXN-2024-002'
  },
  {
    id: 'PAY003',
    type: 'legal',
    amount: 2000,
    currency: 'USD',
    status: 'overdue',
    date: '2024-01-10',
    dueDate: '2024-01-14',
    surrogate: 'Jennifer Adams',
    parents: 'Michael & Sarah Johnson',
    description: 'Legal fees payment',
    method: 'Wire Transfer',
    reference: 'TXN-2024-003'
  },
  {
    id: 'PAY004',
    type: 'monthly',
    amount: 1500,
    currency: 'USD',
    status: 'scheduled',
    date: '2024-01-25',
    dueDate: '2024-01-25',
    surrogate: 'Amanda Wilson',
    parents: 'David & Lisa Chen',
    description: 'Monthly allowance payment',
    method: 'Direct Deposit',
    reference: 'TXN-2024-004'
  },
  {
    id: 'PAY005',
    type: 'bonus',
    amount: 5000,
    currency: 'USD',
    status: 'processing',
    date: '2024-01-18',
    dueDate: '2024-01-22',
    surrogate: 'Rachel Green',
    parents: 'Thomas & Emily Brown',
    description: 'Successful delivery bonus',
    method: 'Bank Transfer',
    reference: 'TXN-2024-005'
  }
];

const paymentStats = [
  { label: 'Total Payments', value: '$156,000', change: '+12%', icon: 'ri-money-dollar-circle-line', color: 'blue' },
  { label: 'Pending Payments', value: '$8,500', change: '-5%', icon: 'ri-time-line', color: 'yellow' },
  { label: 'Overdue Payments', value: '$2,000', change: '+2%', icon: 'ri-error-warning-line', color: 'red' },
  { label: 'This Month', value: '$32,000', change: '+18%', icon: 'ri-calendar-line', color: 'green' }
];

const paymentTypes = [
  { id: 'all', label: 'All Payments', count: payments.length },
  { id: 'compensation', label: 'Compensation', count: payments.filter(p => p.type === 'compensation').length },
  { id: 'medical', label: 'Medical', count: payments.filter(p => p.type === 'medical').length },
  { id: 'legal', label: 'Legal', count: payments.filter(p => p.type === 'legal').length },
  { id: 'monthly', label: 'Monthly', count: payments.filter(p => p.type === 'monthly').length },
  { id: 'bonus', label: 'Bonus', count: payments.filter(p => p.type === 'bonus').length }
];

const PaymentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);

  const filteredPayments = activeTab === 'all' 
    ? payments 
    : payments.filter(payment => payment.type === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge color="green">Completed</Badge>;
      case 'pending':
        return <Badge color="yellow">Pending</Badge>;
      case 'processing':
        return <Badge color="blue">Processing</Badge>;
      case 'scheduled':
        return <Badge color="gray">Scheduled</Badge>;
      case 'overdue':
        return <Badge color="red">Overdue</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'compensation':
        return 'ri-money-dollar-circle-line';
      case 'medical':
        return 'ri-health-book-line';
      case 'legal':
        return 'ri-file-text-line';
      case 'monthly':
        return 'ri-calendar-line';
      case 'bonus':
        return 'ri-gift-line';
      default:
        return 'ri-money-dollar-circle-line';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'compensation':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400';
      case 'medical':
        return 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400';
      case 'legal':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400';
      case 'monthly':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400';
      case 'bonus':
        return 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Payments</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage all financial transactions and payments.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <i className="ri-download-line mr-2"></i>
                  Export
                </Button>
                <Button color="blue" onClick={() => setShowNewPaymentModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  New Payment
                </Button>
              </div>
            </div>
          </div>

          {/* Payment Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {paymentStats.map((stat, index) => (
              <Card key={index}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change} from last month
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${stat.color}-100 dark:bg-${stat.color}-900`}>
                    <i className={`${stat.icon} text-xl text-${stat.color}-600 dark:text-${stat.color}-400`}></i>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Payment Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {paymentTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveTab(type.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === type.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {type.label} ({type.count})
                </button>
              ))}
            </div>
          </div>

          {/* Payments List */}
          <div className="space-y-4">
            {filteredPayments.map((payment) => (
              <Card key={payment.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedPayment(payment)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(payment.type)}`}>
                      <i className={`${getTypeIcon(payment.type)} text-lg`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{payment.description}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {payment.surrogate} → {payment.parents}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Due: {payment.dueDate} • {payment.method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(payment.amount, payment.currency)}
                    </div>
                    {getStatusBadge(payment.status)}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Ref: {payment.reference}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Payment Detail Modal */}
          {selectedPayment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Details</h2>
                    <button
                      onClick={() => setSelectedPayment(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getTypeColor(selectedPayment.type)}`}>
                        <i className={`${getTypeIcon(selectedPayment.type)} text-2xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedPayment.description}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Payment ID: {selectedPayment.id}</p>
                        {getStatusBadge(selectedPayment.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Information</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                            <span className="text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Type:</span>
                            <span className="text-gray-900 dark:text-white capitalize">{selectedPayment.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Method:</span>
                            <span className="text-gray-900 dark:text-white">{selectedPayment.method}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Reference:</span>
                            <span className="text-gray-900 dark:text-white">{selectedPayment.reference}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Schedule</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Created:</span>
                            <span className="text-gray-900 dark:text-white">{selectedPayment.date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
                            <span className="text-gray-900 dark:text-white">{selectedPayment.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Parties Involved</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-user-heart-line text-blue-600 dark:text-blue-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Surrogate</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedPayment.surrogate}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-parent-line text-green-600 dark:text-green-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Intended Parents</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedPayment.parents}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit Payment
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-download-line mr-2"></i>
                        Download Receipt
                      </Button>
                      {selectedPayment.status === 'pending' && (
                        <Button color="green" className="flex-1">
                          <i className="ri-check-line mr-2"></i>
                          Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Payment Modal */}
          {showNewPaymentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Payment</h2>
                    <button
                      onClick={() => setShowNewPaymentModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Payment Type
                      </label>
                      <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                        <option value="compensation">Compensation</option>
                        <option value="medical">Medical</option>
                        <option value="legal">Legal</option>
                        <option value="monthly">Monthly</option>
                        <option value="bonus">Bonus</option>
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Currency
                        </label>
                        <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Payment description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Due Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1">
                        <i className="ri-save-line mr-2"></i>
                        Create Payment
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewPaymentModal(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PaymentsPage;
