import React, { useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';

// Mock contracts data
const contracts = [
  {
    id: 'CON001',
    title: 'Surrogacy Agreement - Thompson/Davis',
    type: 'surrogacy_agreement',
    surrogate: 'Emma Thompson',
    parents: 'John & Mary Davis',
    status: 'active',
    createdDate: '2024-01-05',
    signedDate: '2024-01-10',
    expiryDate: '2025-01-10',
    value: 45000,
    currency: 'USD',
    lawyer: 'Attorney Sarah Johnson',
    clauses: 12,
    amendments: 0,
    lastModified: '2024-01-10'
  },
  {
    id: 'CON002',
    title: 'Medical Authorization - Rodriguez/Miller',
    type: 'medical_authorization',
    surrogate: 'Lisa Rodriguez',
    parents: 'Robert & Susan Miller',
    status: 'pending_signature',
    createdDate: '2024-01-12',
    signedDate: null,
    expiryDate: '2024-12-31',
    value: 0,
    currency: 'USD',
    lawyer: 'Attorney Michael Brown',
    clauses: 8,
    amendments: 1,
    lastModified: '2024-01-15'
  },
  {
    id: 'CON003',
    title: 'Compensation Agreement - Adams/Johnson',
    type: 'compensation_agreement',
    surrogate: 'Jennifer Adams',
    parents: 'Michael & Sarah Johnson',
    status: 'under_review',
    createdDate: '2024-01-08',
    signedDate: null,
    expiryDate: '2024-12-31',
    value: 35000,
    currency: 'USD',
    lawyer: 'Attorney David Wilson',
    clauses: 15,
    amendments: 2,
    lastModified: '2024-01-14'
  },
  {
    id: 'CON004',
    title: 'Confidentiality Agreement - Wilson/Chen',
    type: 'confidentiality_agreement',
    surrogate: 'Amanda Wilson',
    parents: 'David & Lisa Chen',
    status: 'expired',
    createdDate: '2023-06-15',
    signedDate: '2023-06-20',
    expiryDate: '2024-01-01',
    value: 0,
    currency: 'USD',
    lawyer: 'Attorney Patricia Lee',
    clauses: 6,
    amendments: 0,
    lastModified: '2023-06-20'
  },
  {
    id: 'CON005',
    title: 'Surrogacy Agreement - Green/Brown',
    type: 'surrogacy_agreement',
    surrogate: 'Rachel Green',
    parents: 'Thomas & Emily Brown',
    status: 'draft',
    createdDate: '2024-01-16',
    signedDate: null,
    expiryDate: null,
    value: 50000,
    currency: 'USD',
    lawyer: 'Attorney Robert Martinez',
    clauses: 14,
    amendments: 0,
    lastModified: '2024-01-18'
  }
];

const contractStats = [
  { label: 'Total Contracts', value: '127', change: '+8%', icon: 'ri-file-text-line', color: 'blue' },
  { label: 'Active Contracts', value: '45', change: '+12%', icon: 'ri-check-line', color: 'green' },
  { label: 'Pending Signature', value: '8', change: '-3%', icon: 'ri-quill-pen-line', color: 'yellow' },
  { label: 'Under Review', value: '12', change: '+5%', icon: 'ri-search-line', color: 'purple' }
];

const contractTypes = [
  { id: 'all', label: 'All Contracts', count: contracts.length },
  { id: 'surrogacy_agreement', label: 'Surrogacy Agreements', count: contracts.filter(c => c.type === 'surrogacy_agreement').length },
  { id: 'medical_authorization', label: 'Medical Authorization', count: contracts.filter(c => c.type === 'medical_authorization').length },
  { id: 'compensation_agreement', label: 'Compensation', count: contracts.filter(c => c.type === 'compensation_agreement').length },
  { id: 'confidentiality_agreement', label: 'Confidentiality', count: contracts.filter(c => c.type === 'confidentiality_agreement').length }
];

const ContractsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showNewContractModal, setShowNewContractModal] = useState(false);

  const filteredContracts = activeTab === 'all' 
    ? contracts 
    : contracts.filter(contract => contract.type === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="green">Active</Badge>;
      case 'pending_signature':
        return <Badge color="yellow">Pending Signature</Badge>;
      case 'under_review':
        return <Badge color="blue">Under Review</Badge>;
      case 'draft':
        return <Badge color="gray">Draft</Badge>;
      case 'expired':
        return <Badge color="red">Expired</Badge>;
      case 'terminated':
        return <Badge color="red">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getContractTypeIcon = (type: string) => {
    switch (type) {
      case 'surrogacy_agreement':
        return 'ri-file-text-line';
      case 'medical_authorization':
        return 'ri-health-book-line';
      case 'compensation_agreement':
        return 'ri-money-dollar-circle-line';
      case 'confidentiality_agreement':
        return 'ri-shield-check-line';
      default:
        return 'ri-file-line';
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'surrogacy_agreement':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400';
      case 'medical_authorization':
        return 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400';
      case 'compensation_agreement':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400';
      case 'confidentiality_agreement':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatContractType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Contracts</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage legal agreements and documentation.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <i className="ri-download-line mr-2"></i>
                  Export Contracts
                </Button>
                <Button color="blue" onClick={() => setShowNewContractModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  New Contract
                </Button>
              </div>
            </div>
          </div>

          {/* Contract Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {contractStats.map((stat, index) => (
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

          {/* Contract Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {contractTypes.map((type) => (
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

          {/* Contracts List */}
          <div className="space-y-4">
            {filteredContracts.map((contract) => (
              <Card key={contract.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedContract(contract)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getContractTypeColor(contract.type)}`}>
                      <i className={`${getContractTypeIcon(contract.type)} text-lg`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{contract.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {contract.surrogate} ↔ {contract.parents}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Created: {contract.createdDate} • {contract.lawyer}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(contract.status)}
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(contract.value, contract.currency)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {contract.clauses} clauses • {contract.amendments} amendments
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Contract Detail Modal */}
          {selectedContract && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contract Details</h2>
                    <button
                      onClick={() => setSelectedContract(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${getContractTypeColor(selectedContract.type)}`}>
                        <i className={`${getContractTypeIcon(selectedContract.type)} text-2xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedContract.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400">Contract ID: {selectedContract.id}</p>
                        {getStatusBadge(selectedContract.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Contract Information</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Type:</span>
                            <span className="text-gray-900 dark:text-white">{formatContractType(selectedContract.type)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Value:</span>
                            <span className="text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(selectedContract.value, selectedContract.currency)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Clauses:</span>
                            <span className="text-gray-900 dark:text-white">{selectedContract.clauses}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Amendments:</span>
                            <span className="text-gray-900 dark:text-white">{selectedContract.amendments}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Timeline</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Created:</span>
                            <span className="text-gray-900 dark:text-white">{selectedContract.createdDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Signed:</span>
                            <span className="text-gray-900 dark:text-white">
                              {selectedContract.signedDate || 'Not signed'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Expires:</span>
                            <span className="text-gray-900 dark:text-white">
                              {selectedContract.expiryDate || 'No expiry'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Last Modified:</span>
                            <span className="text-gray-900 dark:text-white">{selectedContract.lastModified}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Parties Involved</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-user-heart-line text-blue-600 dark:text-blue-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Surrogate</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedContract.surrogate}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-parent-line text-green-600 dark:text-green-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Intended Parents</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedContract.parents}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-scales-3-line text-purple-600 dark:text-purple-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Legal Counsel</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedContract.lawyer}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1">
                        <i className="ri-edit-line mr-2"></i>
                        Edit Contract
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-download-line mr-2"></i>
                        Download PDF
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <i className="ri-share-line mr-2"></i>
                        Share Contract
                      </Button>
                      {selectedContract.status === 'draft' && (
                        <Button color="green" className="flex-1">
                          <i className="ri-send-plane-line mr-2"></i>
                          Send for Signature
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Contract Modal */}
          {showNewContractModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Contract</h2>
                    <button
                      onClick={() => setShowNewContractModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contract Type
                      </label>
                      <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                        <option value="surrogacy_agreement">Surrogacy Agreement</option>
                        <option value="medical_authorization">Medical Authorization</option>
                        <option value="compensation_agreement">Compensation Agreement</option>
                        <option value="confidentiality_agreement">Confidentiality Agreement</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contract Title
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Enter contract title"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Surrogate
                        </label>
                        <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                          <option value="">Select surrogate</option>
                          <option value="emma">Emma Thompson</option>
                          <option value="lisa">Lisa Rodriguez</option>
                          <option value="jennifer">Jennifer Adams</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Intended Parents
                        </label>
                        <select className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                          <option value="">Select parents</option>
                          <option value="davis">John & Mary Davis</option>
                          <option value="miller">Robert & Susan Miller</option>
                          <option value="johnson">Michael & Sarah Johnson</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Contract Value
                        </label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Legal Counsel
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Attorney name"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button color="blue" className="flex-1">
                        <i className="ri-save-line mr-2"></i>
                        Create Contract
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowNewContractModal(false)}>
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

export default ContractsPage;
