import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { contractService } from '../../services/contractService';
import type { Contract } from '../../services/contractService';

const ContractsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showNewContractModal, setShowNewContractModal] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setIsLoading(true);
    try {
      const data = await contractService.getAllContracts();
      setContracts(data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContracts = activeTab === 'all' 
    ? contracts 
    : contracts.filter(contract => contract.type === activeTab);

  const contractTypes = [
    { id: 'all', label: 'All Contracts', count: contracts.length },
    { id: 'surrogacy_agreement', label: 'Surrogacy Agreements', count: contracts.filter(c => c.type === 'surrogacy_agreement').length },
    { id: 'medical_authorization', label: 'Medical Authorization', count: contracts.filter(c => c.type === 'medical_authorization').length },
    { id: 'compensation_agreement', label: 'Compensation', count: contracts.filter(c => c.type === 'compensation_agreement').length },
    { id: 'confidentiality_agreement', label: 'Confidentiality', count: contracts.filter(c => c.type === 'confidentiality_agreement').length }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="green">Active</Badge>;
      case 'pending_signature':
        return <Badge color="yellow">Pending Signature</Badge>;
      case 'under_review':
        return <Badge color="blue">Under Review</Badge>;
      case 'draft':
        return <Badge>Draft</Badge>;
      case 'expired':
        return <Badge color="red">Expired</Badge>;
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

  const formatCurrency = (amount: number) => {
    if (amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
                <Button color="blue" onClick={() => setShowNewContractModal(true)}>
                  <i className="ri-add-line mr-2"></i>
                  New Contract
                </Button>
              </div>
            </div>
          </div>

          {/* Contract Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit flex-wrap">
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

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <i className="ri-file-text-line text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400">No contracts found.</p>
            </div>
          ) : (
            /* Contracts List */
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
                          {contract.surrogateName} ↔ {contract.parentName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Created: {new Date(contract.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(contract.status)}
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(contract.value)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Contract Detail Modal */}
          {selectedContract && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                        <p className="text-gray-600 dark:text-gray-400">Contract ID: {selectedContract.id.slice(0, 8)}</p>
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
                              {formatCurrency(selectedContract.value)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Timeline</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Created:</span>
                            <span className="text-gray-900 dark:text-white">{new Date(selectedContract.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Parties Involved</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-user-heart-line text-blue-600 dark:text-blue-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Surrogate</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedContract.surrogateName}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="ri-parent-line text-green-600 dark:text-green-400"></i>
                            <span className="font-medium text-gray-900 dark:text-white">Intended Parents</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{selectedContract.parentName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button color="blue" className="flex-1" onClick={() => setSelectedContract(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Contract Modal - Placeholder */}
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

                  <div className="text-center py-8">
                    <i className="ri-file-add-line text-4xl text-gray-400 mb-4"></i>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Contract creation form will be implemented here.
                    </p>
                    <Button variant="outline" onClick={() => setShowNewContractModal(false)}>
                      Close
                    </Button>
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
