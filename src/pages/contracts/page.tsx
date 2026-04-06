import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { contractService } from '../../services/contractService';
import type { Contract, ContractEsignStatus } from '../../services/contractService';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../utils/permissions';

const CONTRACT_TYPES = [
  { id: 'surrogacy_agreement',    label: 'Surrogacy Agreement',     icon: 'ri-file-text-line',              color: 'bg-blue-100 dark:bg-blue-900 text-rose-500 dark:text-rose-400' },
  { id: 'medical_authorization',  label: 'Medical Authorization',   icon: 'ri-health-book-line',            color: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' },
  { id: 'compensation_agreement', label: 'Compensation Agreement',  icon: 'ri-money-dollar-circle-line',    color: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400' },
  { id: 'confidentiality_agreement', label: 'Confidentiality NDA', icon: 'ri-shield-check-line',           color: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400' },
  { id: 'escrow_agreement',       label: 'Escrow Agreement',        icon: 'ri-safe-line',                   color: 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400' },
  { id: 'other',                  label: 'Other',                   icon: 'ri-file-line',                   color: 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400' },
];

const CONTRACT_STATUSES = ['draft', 'under_review', 'pending_signature', 'active', 'expired', 'cancelled'];

const ESIGN_STATUSES: ContractEsignStatus[] = [
  'Not Sent', 'Sent to GC', 'Sent to IP', 'Partially Signed', 'Fully Signed', 'Expired',
];

const esignColor = (s?: ContractEsignStatus): any => ({
  'Fully Signed': 'green',
  'Partially Signed': 'yellow',
  'Sent to GC': 'blue',
  'Sent to IP': 'blue',
  'Not Sent': 'gray',
  'Expired': 'red',
})[s || 'Not Sent'] || 'gray';

const statusColor = (s: string): any => ({
  active: 'green', pending_signature: 'yellow', under_review: 'blue',
  draft: 'gray', expired: 'red', cancelled: 'red',
})[s] || 'gray';

const formatType = (t: string) => CONTRACT_TYPES.find(c => c.id === t)?.label || t.replace(/_/g, ' ');

const ContractsPage: React.FC = () => {
  const { user: authUser, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [newContract, setNewContract] = useState<Partial<Contract>>({
    type: 'surrogacy_agreement',
    status: 'draft',
    esignStatus: 'Not Sent',
    value: 0,
  });

  useEffect(() => { fetchContracts(); }, []);

  const fetchContracts = async () => {
    setIsLoading(true);
    try {
      const data = await contractService.getAllContracts();
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newContract.title?.trim() || !newContract.type) {
      alert('Title and type are required');
      return;
    }
    setIsSaving(true);
    try {
      await contractService.createContract(newContract);
      setShowNewModal(false);
      setNewContract({ type: 'surrogacy_agreement', status: 'draft', esignStatus: 'Not Sent', value: 0 });
      fetchContracts();
    } catch {
      alert('Failed to create contract');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEsignUpdate = async (id: string, status: ContractEsignStatus) => {
    try {
      await contractService.updateEsignStatus(id, status);
      setContracts(prev => prev.map(c => c.id === id ? { ...c, esignStatus: status } : c));
      if (selectedContract?.id === id) setSelectedContract(prev => prev ? { ...prev, esignStatus: status } : prev);
    } catch {
      alert('Failed to update e-sign status');
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await contractService.updateContractStatus(id, status);
      setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      if (selectedContract?.id === id) setSelectedContract(prev => prev ? { ...prev, status } : prev);
    } catch {
      alert('Failed to update status');
    }
  };

  const tabs = [
    { id: 'all', label: 'All', count: contracts.length },
    ...CONTRACT_TYPES.map(t => ({ id: t.id, label: t.label, count: contracts.filter(c => c.type === t.id).length })),
  ];

  const filtered = activeTab === 'all' ? contracts : contracts.filter(c => c.type === activeTab);

  const getTypeInfo = (type: string) => CONTRACT_TYPES.find(c => c.id === type) || CONTRACT_TYPES[CONTRACT_TYPES.length - 1];

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contracts</h1>
              <p className="text-sm text-gray-500 mt-1">Manage legal agreements, e-signature status, and journey links.</p>
            </div>
            <Button color="blue" onClick={() => setShowNewModal(true)}>
              <i className="ri-add-line mr-2"></i>New Contract
            </Button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total', value: contracts.length, color: 'text-gray-900 dark:text-white' },
              { label: 'Active', value: contracts.filter(c => c.status === 'active').length, color: 'text-green-600' },
              { label: 'Pending Signature', value: contracts.filter(c => c.status === 'pending_signature').length, color: 'text-yellow-600' },
              { label: 'Fully Signed', value: contracts.filter(c => c.esignStatus === 'Fully Signed').length, color: 'text-blue-600' },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-[#15111f] p-1 rounded-lg w-fit flex-wrap mb-6 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><i className="ri-loader-4-line text-3xl animate-spin text-blue-500"></i></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
              <i className="ri-file-text-line text-4xl text-gray-300 mb-2 block"></i>
              <p className="text-gray-500">No contracts yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => {
                const ti = getTypeInfo(c.type);
                return (
                  <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedContract(c)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ti.color}`}>
                        <i className={`${ti.icon} text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{c.title}</h3>
                          <Badge color={statusColor(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
                          <Badge color={esignColor(c.esignStatus)}><i className="ri-pen-nib-line mr-1"></i>{c.esignStatus || 'Not Sent'}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.surrogateName} ↔ {c.parentName}
                          {c.journeyId && <span className="ml-2 text-blue-500"><i className="ri-route-line mr-0.5"></i>Journey linked</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.value ? `$${c.value.toLocaleString()}` : '—'}</p>
                        <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedContract.title}</h2>
                <button onClick={() => setSelectedContract(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"><i className="ri-close-line text-gray-500"></i></button>
              </div>

              <div className="space-y-5">
                {/* Parties */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Surrogate</p>
                    <p className="font-medium">{selectedContract.surrogateName}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Intended Parent</p>
                    <p className="font-medium">{selectedContract.parentName}</p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium">{formatType(selectedContract.type)}</span></div>
                  <div><span className="text-gray-500">Value:</span> <span className="font-medium">{selectedContract.value ? `$${selectedContract.value.toLocaleString()}` : '—'}</span></div>
                  <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(selectedContract.createdAt).toLocaleDateString()}</span></div>
                  {selectedContract.journeyId && <div><span className="text-gray-500">Journey:</span> <span className="font-mono text-xs">{selectedContract.journeyId.slice(0,8)}</span></div>}
                </div>

                {/* Document URL */}
                {selectedContract.documentUrl && (
                  <a href={selectedContract.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                    <i className="ri-file-download-line"></i> View Document
                  </a>
                )}

                {/* Status controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Contract Status</label>
                    <select
                      value={selectedContract.status}
                      onChange={e => handleStatusUpdate(selectedContract.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm"
                    >
                      {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">E-Sign Status</label>
                    <select
                      value={selectedContract.esignStatus || 'Not Sent'}
                      onChange={e => handleEsignUpdate(selectedContract.id, e.target.value as ContractEsignStatus)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm"
                    >
                      {ESIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* E-sign status timeline */}
                <div className="flex gap-2 flex-wrap">
                  <Badge color={esignColor(selectedContract.esignStatus)}>
                    <i className="ri-pen-nib-line mr-1"></i>{selectedContract.esignStatus || 'Not Sent'}
                  </Badge>
                  {selectedContract.esignSentAt && <span className="text-xs text-gray-400">Sent: {new Date(selectedContract.esignSentAt).toLocaleDateString()}</span>}
                  {selectedContract.esignSignedAt && <span className="text-xs text-green-600 font-medium">Fully signed: {new Date(selectedContract.esignSignedAt).toLocaleDateString()}</span>}
                </div>

                {/* HIPAA / e-sign send stub */}
                <div className="rounded-xl border border-dashed border-blue-200 dark:border-blue-800 p-4 bg-blue-50/50 dark:bg-blue-900/10">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1"><i className="ri-send-plane-line mr-1"></i>Send for E-Signature</p>
                  <p className="text-xs text-gray-500 mb-3">Integrate with DocuSign or HelloSign to send a secure signing link. Update the E-Sign Status above once sent.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      const email = window.prompt('GC email address to send signing link:');
                      if (email?.trim()) {
                        handleEsignUpdate(selectedContract.id, 'Sent to GC');
                        alert(`[Stub] Signing link would be sent to ${email}. Update your e-sign provider integration here.`);
                      }
                    }}>Send to GC</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const email = window.prompt('IP email address to send signing link:');
                      if (email?.trim()) {
                        handleEsignUpdate(selectedContract.id, 'Sent to IP');
                        alert(`[Stub] Signing link would be sent to ${email}. Update your e-sign provider integration here.`);
                      }
                    }}>Send to IP</Button>
                  </div>
                </div>

                {selectedContract.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedContract.notes}</p>
                  </div>
                )}

                {hasPermission(profile?.role, 'override_guardrails') && (
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                    <button onClick={async () => {
                      if (!window.confirm('Delete this contract? This cannot be undone.')) return;
                      await contractService.deleteContract(selectedContract.id);
                      setSelectedContract(null);
                      fetchContracts();
                    }} className="text-xs text-red-400 hover:text-red-600">
                      <i className="ri-delete-bin-line mr-1"></i>Delete Contract (Admin only)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Contract Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Contract</h2>
                <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"><i className="ri-close-line text-gray-500"></i></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input value={newContract.title || ''} onChange={e => setNewContract(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Surrogacy Agreement – Smith & Johnson" className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                  <select value={newContract.type || ''} onChange={e => setNewContract(p => ({ ...p, type: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm">
                    {CONTRACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Surrogate Name</label>
                    <input value={newContract.surrogateName || ''} onChange={e => setNewContract(p => ({ ...p, surrogateName: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Name</label>
                    <input value={newContract.parentName || ''} onChange={e => setNewContract(p => ({ ...p, parentName: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value ($)</label>
                    <input type="number" value={newContract.value || ''} onChange={e => setNewContract(p => ({ ...p, value: parseFloat(e.target.value) }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Status</label>
                    <select value={newContract.status || 'draft'} onChange={e => setNewContract(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm">
                      {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Journey ID (optional)</label>
                  <input value={newContract.journeyId || ''} onChange={e => setNewContract(p => ({ ...p, journeyId: e.target.value }))} placeholder="Link to a journey" className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document URL (optional)</label>
                  <input value={newContract.documentUrl || ''} onChange={e => setNewContract(p => ({ ...p, documentUrl: e.target.value }))} placeholder="https://..." className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={newContract.notes || ''} onChange={e => setNewContract(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0b1a] px-3 py-2 text-sm resize-none" />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
                  <Button color="blue" onClick={handleCreate} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Create Contract'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsPage;
