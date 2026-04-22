import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { matchService } from '../../services/matchService';
import type { Match, MatchStatus, User } from '../../types';
import Toast from '../../components/base/Toast';
import ConfirmationDialog from '../../components/base/ConfirmationDialog';
import { useAuth } from '../../contexts/AuthContext';
import { formatMMDDYYYY } from '../../utils/dateFormat';

const MATCH_STATUSES: MatchStatus[] = [
  'Proposed',
  'Presented',
  'Accepted',
  'Active',
  'Delivered',
  'Escrow Closure',
  'Completed',
  'Cancelled',
];

// Valid transitions for UI guardrails
const VALID_TRANSITIONS: Record<string, MatchStatus[]> = {
  'Proposed':       ['Presented', 'Cancelled'],
  'Presented':      ['Accepted', 'Cancelled'],
  'Accepted':       ['Active', 'Cancelled'],
  'Active':         ['Delivered', 'Cancelled'],
  'Delivered':      ['Escrow Closure', 'Cancelled'],
  'Escrow Closure': ['Completed'],
  'Completed':      [],
  'Cancelled':      [],
};

const MatchesPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MatchStatus | 'All'>('All');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingMatchStatus, setIsUpdatingMatchStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create Match modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleGCs, setEligibleGCs] = useState<User[]>([]);
  const [eligibleIPs, setEligibleIPs] = useState<User[]>([]);
  const [selectedGC, setSelectedGC] = useState<User | null>(null);
  const [selectedIP, setSelectedIP] = useState<User | null>(null);
  const [newMatchNotes, setNewMatchNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);

  // Status transition modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MatchStatus | null>(null);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const [showDeleteMatchDialog, setShowDeleteMatchDialog] = useState(false);
  const [isDeletingMatch, setIsDeletingMatch] = useState(false);

  // GC/IP filter for two-panel view
  const [gcSearch, setGcSearch] = useState('');
  const [ipSearch, setIpSearch] = useState('');

  const getFullName = (user?: any) => {
    if (!user) return "Not Assigned";
    if (user.full_name) return user.full_name;
    const first = user.first_name || user.firstName || "";
    const last = user.last_name || user.lastName || "";
    return `${first} ${last}`.trim() || user.email || "Unnamed User";
  };

  // ─── Rich card helpers (extract from form_data) ──────────────────────────
  const getFormData = (user: any) => user?.form_data || user?.formData || {};

  const getGCDetails = (gc: any) => {
    const fd = getFormData(gc);
    const sp = fd?.surrogate_profile || {};
    const city = fd?.city || sp?.city || '';
    const state = fd?.state || sp?.state || '';
    const location = [city, state].filter(Boolean).join(', ') || 'Not specified';
    const clearance = gc?.medical_screening_status || fd?.medical_screening_status || 'Not Screened';
    const pregnancies = sp?.pregnancyHistory?.total || fd?.pregnancies || '—';
    const deliveryTypes = sp?.deliveryType || fd?.deliveryType || '—';
    return { location, clearance, pregnancies, deliveryTypes };
  };

  const getIPDetails = (ip: any) => {
    const fd = getFormData(ip);
    const city = fd?.city || '';
    const state = fd?.state || '';
    const location = [city, state].filter(Boolean).join(', ') || 'Not specified';
    const timeline = fd?.whenToStart || 'No timeline set';
    const parentType = fd?.parentType || fd?.relationship_status || '—';
    return { location, timeline, parentType };
  };

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const data = await matchService.getAllMatches();
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligibleCandidates = async () => {
    setIsLoadingEligible(true);
    try {
      const [gcs, ips] = await Promise.all([
        matchService.getEligibleSurrogates(),
        matchService.getEligibleParents(),
      ]);
      setEligibleGCs(gcs);
      setEligibleIPs(ips);
    } catch (error) {
      console.error('Error fetching eligible candidates:', error);
      setToast({ message: 'Failed to load eligible candidates', type: 'error' });
    } finally {
      setIsLoadingEligible(false);
    }
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setSelectedGC(null);
    setSelectedIP(null);
    setNewMatchNotes('');
    setGcSearch('');
    setIpSearch('');
    fetchEligibleCandidates();
  };

  // ─── Create Match ────────────────────────────────────────────────────────
  const handleCreateMatch = async () => {
    if (!selectedGC || !selectedIP) {
      setToast({ message: 'Please select both a GC and an IP', type: 'error' });
      return;
    }

    setIsCreating(true);
    try {
      await matchService.createMatch({
        intendedParentId: selectedIP.id,
        gestationalCarrierId: selectedGC.id,
        agencyNotes: newMatchNotes,
        coordinatorId: authUser?.id,
      });

      setToast({ message: 'Match created successfully!', type: 'success' });
      setShowCreateModal(false);
      await fetchMatches();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to create match', type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Status Change with Guardrails ──────────────────────────────────────
  const handleStatusChangeRequest = (newStatus: MatchStatus) => {
    if (!selectedMatch) return;

    // Check if this needs extra data
    if (newStatus === 'Active') {
      // Active requires journey creation – use activateMatch flow
      handleActivateMatch();
      return;
    }

    if (newStatus === 'Delivered') {
      setPendingStatus(newStatus);
      setDeliveryDateInput('');
      setShowStatusModal(true);
      return;
    }

    if (newStatus === 'Cancelled') {
      setPendingStatus(newStatus);
      setCancellationReasonInput('');
      setShowStatusModal(true);
      return;
    }

    // Direct transitions (Proposed→Presented, Presented→Accepted, etc.)
    handleStatusChange(newStatus);
  };

  const handleStatusChange = async (newStatus: MatchStatus, additionalData?: any) => {
    if (!selectedMatch?.id) return;

    setIsUpdatingMatchStatus(true);
    try {
      await matchService.updateMatchStatus(selectedMatch.id, newStatus, additionalData);

      setSelectedMatch(prev =>
        prev ? { ...prev, status: newStatus, ...additionalData } : prev
      );
      setMatches(prev =>
        prev.map(m =>
          m.id === selectedMatch.id ? { ...m, status: newStatus, ...additionalData } : m
        )
      );

      setToast({ message: `Status updated to "${newStatus}"`, type: 'success' });
      setShowStatusModal(false);
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to update status', type: 'error' });
    } finally {
      setIsUpdatingMatchStatus(false);
    }
  };

  const handleActivateMatch = async () => {
    if (!selectedMatch?.id || !authUser?.id) return;

    setIsActivating(true);
    try {
      const journeyId = await matchService.activateMatch(selectedMatch.id, authUser.id);

      setSelectedMatch(prev =>
        prev ? { ...prev, status: 'Active', journeyId } : prev
      );
      setMatches(prev =>
        prev.map(m =>
          m.id === selectedMatch.id ? { ...m, status: 'Active', journeyId } : m
        )
      );

      setToast({ message: 'Match activated! Journey created.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to activate match', type: 'error' });
    } finally {
      setIsActivating(false);
    }
  };

  const handleCreateJourneyForActiveMatch = async () => {
    if (!selectedMatch?.id || !authUser?.id) return;

    setIsActivating(true);
    try {
      const journeyId = await matchService.createJourneyForActiveMatch(selectedMatch.id, authUser.id);

      setSelectedMatch(prev => (prev ? { ...prev, journeyId } : prev));
      setMatches(prev =>
        prev.map(m => (m.id === selectedMatch.id ? { ...m, journeyId } : m))
      );

      setToast({ message: 'Journey created and linked to this match.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to create journey', type: 'error' });
    } finally {
      setIsActivating(false);
    }
  };

  const handleConfirmDeleteMatch = async () => {
    if (!selectedMatch?.id) return;
    setIsDeletingMatch(true);
    try {
      await matchService.deleteMatch(selectedMatch.id);
      setMatches(prev => prev.filter(m => m.id !== selectedMatch.id));
      setSelectedMatch(null);
      setShowDeleteMatchDialog(false);
      setToast({ message: 'Match deleted successfully.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to delete match', type: 'error' });
    } finally {
      setIsDeletingMatch(false);
    }
  };

  const confirmStatusWithData = () => {
    if (!pendingStatus) return;

    if (pendingStatus === 'Delivered' && !deliveryDateInput) {
      setToast({ message: 'Delivery date is required', type: 'error' });
      return;
    }
    if (pendingStatus === 'Cancelled' && !cancellationReasonInput.trim()) {
      setToast({ message: 'Cancellation reason is required', type: 'error' });
      return;
    }

    const additionalData: any = {};
    if (pendingStatus === 'Delivered') additionalData.deliveryDate = deliveryDateInput;
    if (pendingStatus === 'Cancelled') additionalData.cancellationReason = cancellationReasonInput;

    handleStatusChange(pendingStatus, additionalData);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getDerivedStatus = (match: Match): MatchStatus | string => {
    if (match.parentDeclined || match.surrogateDeclined) return 'Cancelled';
    return match.status;
  };

  const filteredMatches = activeTab === 'All'
    ? matches
    : matches.filter(match => getDerivedStatus(match) === activeTab);

  const getStatusBadge = (status: MatchStatus | string) => {
    const colorMap: Record<string, string> = {
      'Proposed': 'yellow',
      'Presented': 'blue',
      'Accepted': 'green',
      'Active': 'green',
      'Delivered': 'orange',
      'Escrow Closure': 'teal',
      'Completed': 'teal',
      'Cancelled': 'red',
    };
    return <Badge color={(colorMap[status] || 'gray') as any}>{status}</Badge>;
  };

  const getAvailableTransitions = (status: string): MatchStatus[] => {
    return VALID_TRANSITIONS[status] || [];
  };

  const filteredGCs = eligibleGCs.filter(gc => {
    if (!gcSearch) return true;
    const name = getFullName(gc).toLowerCase();
    return name.includes(gcSearch.toLowerCase()) || gc.email?.toLowerCase().includes(gcSearch.toLowerCase());
  });

  const filteredIPs = eligibleIPs.filter(ip => {
    if (!ipSearch) return true;
    const name = getFullName(ip).toLowerCase();
    return name.includes(ipSearch.toLowerCase()) || ip.email?.toLowerCase().includes(ipSearch.toLowerCase());
  });

  const matchStatuses: { id: MatchStatus | 'All'; label: string }[] = [
    { id: 'All', label: 'All Matches' },
    ...MATCH_STATUSES.map(s => ({ id: s, label: s })),
  ];

  return (
    <div className="flex h-screen bg-[#fdf4f6] dark:bg-[#0e0b1a]">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Matches Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track all surrogate-parent matches and their lifecycle.</p>
              </div>
              <Button color="blue" onClick={handleOpenCreateModal}>
                <i className="ri-add-line mr-2"></i>
                Create Match
              </Button>
            </div>
          </div>

          {/* Pipeline Overview */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Matches</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{matches.length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600">{matches.filter(m => m.status === 'Active').length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{matches.filter(m => ['Proposed', 'Presented'].includes(m.status)).length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-teal-600">{matches.filter(m => m.status === 'Completed').length}</p>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-[#15111f] p-1 rounded-lg w-fit flex-wrap">
              {matchStatuses.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setActiveTab(status.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === status.id
                      ? 'bg-white dark:bg-white/5 text-rose-500 dark:text-rose-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {status.label} ({
                    status.id === 'All'
                      ? matches.length
                      : matches.filter(m => getDerivedStatus(m) === status.id).length
                  })
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#15111f] rounded-2xl border border-dashed border-gray-300 dark:border-white/5">
              <i className="ri-links-line text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 dark:text-gray-400">No matches found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMatches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedMatch(match)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <i className="ri-links-line text-green-600 dark:text-green-400 text-lg"></i>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Match #{match.id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Created {formatMMDDYYYY(match.createdAt)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(getDerivedStatus(match))}
                  </div>

                  <div className="space-y-3 mb-4">
                    {/* GC Info */}
                    <div className="flex items-center gap-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center">
                        <i className="ri-user-heart-line text-pink-600 dark:text-pink-400"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{getFullName(match.gestationalCarrierData)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Surrogate</p>
                      </div>
                    </div>

                    {/* IP Info */}
                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{getFullName(match.intendedParentData)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Intended Parent</p>
                      </div>
                    </div>

                    {/* Acceptance Row */}
                    <div className="flex gap-4 border-t border-rose-100/40 dark:border-white/5 pt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase">IP:</span>
                        {match.parentAccepted ? (
                          <Badge color="green" size="sm"><i className="ri-checkbox-circle-fill mr-1"></i>Accepted</Badge>
                        ) : match.parentDeclined ? (
                          <Badge color="red" size="sm"><i className="ri-close-circle-fill mr-1"></i>Declined</Badge>
                        ) : (
                          <Badge color="gray" size="sm">Pending</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase">GC:</span>
                        {match.surrogateAccepted ? (
                          <Badge color="green" size="sm"><i className="ri-checkbox-circle-fill mr-1"></i>Accepted</Badge>
                        ) : match.surrogateDeclined ? (
                          <Badge color="red" size="sm"><i className="ri-close-circle-fill mr-1"></i>Declined</Badge>
                        ) : (
                          <Badge color="gray" size="sm">Pending</Badge>
                        )}
                      </div>
                    </div>

                    {/* Journey indicator */}
                    <div className="flex items-center gap-2 text-xs">
                      <i className={`ri-route-line ${match.journeyId ? 'text-green-500' : 'text-gray-400'}`}></i>
                      <span className={match.journeyId ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {match.journeyId ? 'Journey Created' : 'No Journey'}
                      </span>
                    </div>
                  </div>

                  <Button size="sm" className="w-full">
                    <i className="ri-eye-line mr-1"></i>
                    View Details
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* MATCH DETAIL MODAL                                                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {selectedMatch && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Match Details</h2>
                    <button
                      onClick={() => setSelectedMatch(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                    >
                      <i className="ri-close-line text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Header Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <i className="ri-links-line text-green-600 dark:text-green-400 text-2xl"></i>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Match #{selectedMatch.id.slice(0, 8)}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Created on {formatMMDDYYYY(selectedMatch.createdAt)}</p>
                        <div className="mt-1">{getStatusBadge(getDerivedStatus(selectedMatch))}</div>
                      </div>
                    </div>

                    {/* Status Transition */}
                    <div className="bg-rose-50/50 dark:bg-white/5 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        {getAvailableTransitions(selectedMatch.status).map(nextStatus => {
                          // Special case: Active requires activateMatch
                          if (nextStatus === 'Active') {
                            return (
                              <Button
                                key={nextStatus}
                                size="sm"
                                color="green"
                                onClick={handleActivateMatch}
                                disabled={isActivating || selectedMatch.status !== 'Accepted'}
                              >
                                {isActivating ? (
                                  <><i className="ri-loader-4-line animate-spin mr-1"></i>Creating Journey...</>
                                ) : (
                                  <><i className="ri-rocket-line mr-1"></i>Create Journey & Activate</>
                                )}
                              </Button>
                            );
                          }

                          return (
                            <Button
                              key={nextStatus}
                              size="sm"
                              color={nextStatus === 'Cancelled' ? 'red' : 'blue'}
                              variant={nextStatus === 'Cancelled' ? 'outline' : undefined}
                              onClick={() => handleStatusChangeRequest(nextStatus)}
                              disabled={isUpdatingMatchStatus}
                            >
                              <i className={`mr-1 ${nextStatus === 'Cancelled' ? 'ri-close-circle-line' : 'ri-arrow-right-line'}`}></i>
                              → {nextStatus}
                            </Button>
                          );
                        })}

                        {getAvailableTransitions(selectedMatch.status).length === 0 && (
                          <p className="text-sm text-gray-500 italic">No further transitions available (terminal state).</p>
                        )}

                        {/* Escrow closure for Delivered matches */}
                        {selectedMatch.status === 'Delivered' && (
                          <Button
                            size="sm"
                            color={'teal' as any}
                            onClick={() => {
                              handleStatusChange('Escrow Closure', {
                                escrowClosedAt: new Date().toISOString(),
                              });
                            }}
                            disabled={isUpdatingMatchStatus}
                          >
                            <i className="ri-money-dollar-circle-line mr-1"></i>
                            → Escrow Closure
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* GC & IP Info */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <i className="ri-user-heart-line text-pink-600 dark:text-pink-400"></i>
                          Surrogate
                        </h4>
                        <div className="space-y-2">
                          <p className="text-gray-900 dark:text-white font-medium">{getFullName(selectedMatch.gestationalCarrierData)}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedMatch.gestationalCarrierData?.email}</p>
                          <Badge color="green" size="sm">Eligible to Match</Badge>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <i className="ri-parent-line text-purple-600 dark:text-purple-400"></i>
                          Intended Parent
                        </h4>
                        <div className="space-y-2">
                          <p className="text-gray-900 dark:text-white font-medium">{getFullName(selectedMatch.intendedParentData)}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedMatch.intendedParentData?.email}</p>
                          <Badge color="green" size="sm">Eligible to Match</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Acceptance Status */}
                    <div className="p-4 bg-rose-50/50 dark:bg-white/5/50 rounded-lg border border-rose-100/60 dark:border-white/5">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Acceptance Status</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Intended Parent</p>
                            <p className="text-sm text-gray-500">Decision from the intended parents</p>
                          </div>
                          {selectedMatch.parentAccepted ? (
                            <Badge color="green"><i className="ri-checkbox-circle-fill mr-1"></i>Accepted</Badge>
                          ) : selectedMatch.parentDeclined ? (
                            <Badge color="red"><i className="ri-close-circle-fill mr-1"></i>Declined</Badge>
                          ) : (
                            <Badge color="gray">Pending</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-rose-100/60 dark:border-white/5 pt-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Gestational Carrier</p>
                            <p className="text-sm text-gray-500">Decision from the surrogate</p>
                          </div>
                          {selectedMatch.surrogateAccepted ? (
                            <Badge color="green"><i className="ri-checkbox-circle-fill mr-1"></i>Accepted</Badge>
                          ) : selectedMatch.surrogateDeclined ? (
                            <Badge color="red"><i className="ri-close-circle-fill mr-1"></i>Declined</Badge>
                          ) : (
                            <Badge color="gray">Pending</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lifecycle Details */}
                    {(selectedMatch.deliveryDate || selectedMatch.escrowClosedAt || selectedMatch.cancellationReason) && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Lifecycle Details</h4>
                        <div className="space-y-2 text-sm">
                          {selectedMatch.deliveryDate && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Delivery Date</span>
                              <span className="font-medium text-gray-900 dark:text-white">{formatMMDDYYYY(selectedMatch.deliveryDate)}</span>
                            </div>
                          )}
                          {selectedMatch.escrowClosedAt && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Escrow Closed</span>
                              <span className="font-medium text-gray-900 dark:text-white">{formatMMDDYYYY(selectedMatch.escrowClosedAt)}</span>
                            </div>
                          )}
                          {selectedMatch.cancellationReason && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cancellation Reason</span>
                              <span className="font-medium text-red-600">{selectedMatch.cancellationReason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Journey Link */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-rose-100/60 dark:border-white/5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <i className={`ri-route-line text-xl shrink-0 ${selectedMatch.journeyId ? 'text-green-500' : 'text-gray-400'}`}></i>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedMatch.journeyId ? 'Journey linked' : 'No journey linked'}
                          </p>
                          {selectedMatch.journeyId ? (
                            <p className="text-xs text-gray-500">Journey ID: {selectedMatch.journeyId.slice(0, 8)}</p>
                          ) : selectedMatch.status === 'Active' ? (
                            <p className="text-xs text-amber-700 dark:text-amber-200/90 mt-0.5">
                              This match is Active but has no journey yet. Create one to track the case.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {selectedMatch.status === 'Active' && !selectedMatch.journeyId && (
                        <Button
                          size="sm"
                          color="green"
                          className="shrink-0 w-full sm:w-auto"
                          onClick={handleCreateJourneyForActiveMatch}
                          disabled={isActivating || !authUser?.id}
                        >
                          {isActivating ? (
                            <><i className="ri-loader-4-line animate-spin mr-1"></i>Creating...</>
                          ) : (
                            <><i className="ri-add-line mr-1"></i>Create journey</>
                          )}
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        color="red"
                        className="sm:flex-1 order-2 sm:order-1"
                        onClick={() => setShowDeleteMatchDialog(true)}
                        disabled={isDeletingMatch}
                      >
                        <i className="ri-delete-bin-line mr-1"></i>
                        Delete match
                      </Button>
                      <Button color="blue" className="flex-1 order-1 sm:order-2" onClick={() => setSelectedMatch(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STATUS TRANSITION MODAL (Delivery date / Cancellation reason)       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showStatusModal && pendingStatus && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {pendingStatus === 'Delivered' ? 'Record Delivery' : 'Cancel Match'}
                    </h2>
                    <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {pendingStatus === 'Delivered' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Delivery Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={deliveryDateInput}
                          onChange={(e) => setDeliveryDateInput(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                    )}

                    {pendingStatus === 'Cancelled' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cancellation Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={cancellationReasonInput}
                          onChange={(e) => setCancellationReasonInput(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                          placeholder="Explain why this match is being cancelled..."
                        ></textarea>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)}>Cancel</Button>
                      <Button
                        color={pendingStatus === 'Cancelled' ? 'red' : 'blue'}
                        className="flex-1"
                        onClick={confirmStatusWithData}
                        disabled={isUpdatingMatchStatus}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CREATE MATCH MODAL (Two-panel candidate selection)                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Match</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Only candidates with "Accepted to Program" status are shown.</p>
                    </div>
                    <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  {isLoadingEligible ? (
                    <div className="flex items-center justify-center h-64">
                      <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Two-Panel Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GC Panel */}
                        <div className="border border-rose-100/60 dark:border-white/5 rounded-xl overflow-hidden">
                          <div className="bg-pink-50 dark:bg-pink-900/20 p-4 border-b border-rose-100/60 dark:border-white/5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                                  <i className="ri-user-heart-line text-pink-600 dark:text-pink-300"></i>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">Select Surrogate (GC)</p>
                                  <p className="text-xs text-gray-500">{eligibleGCs.length} eligible</p>
                                </div>
                              </div>
                              {selectedGC && <Badge color="green" size="sm">Selected</Badge>}
                            </div>
                            <input
                              type="text"
                              value={gcSearch}
                              onChange={(e) => setGcSearch(e.target.value)}
                              placeholder="Search by name or email..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredGCs.length === 0 ? (
                              <p className="p-4 text-sm text-gray-500 text-center">No eligible surrogates found.</p>
                            ) : filteredGCs.map(gc => {
                              const details = getGCDetails(gc);
                              return (
                              <div
                                key={gc.id}
                                onClick={() => setSelectedGC(gc)}
                                className={`p-3 border-b border-rose-100/40 dark:border-white/5 cursor-pointer hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-colors ${
                                  selectedGC?.id === gc.id ? 'bg-pink-100 dark:bg-pink-900/30 border-l-4 border-l-pink-500' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{getFullName(gc)}</p>
                                    <p className="text-xs text-gray-500">{gc.email}</p>
                                  </div>
                                  <Badge color={details.clearance === 'Cleared' ? 'green' : 'yellow'} size="sm">
                                    {details.clearance === 'Cleared' ? '✓ Cleared' : details.clearance}
                                  </Badge>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                  <span><i className="ri-map-pin-line mr-0.5"></i>{details.location}</span>
                                  <span><i className="ri-heart-pulse-line mr-0.5"></i>{details.pregnancies} pregnancies</span>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* IP Panel */}
                        <div className="border border-rose-100/60 dark:border-white/5 rounded-xl overflow-hidden">
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 border-b border-rose-100/60 dark:border-white/5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                  <i className="ri-parent-line text-purple-600 dark:text-purple-300"></i>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">Select Intended Parent (IP)</p>
                                  <p className="text-xs text-gray-500">{eligibleIPs.length} eligible</p>
                                </div>
                              </div>
                              {selectedIP && <Badge color="green" size="sm">Selected</Badge>}
                            </div>
                            <input
                              type="text"
                              value={ipSearch}
                              onChange={(e) => setIpSearch(e.target.value)}
                              placeholder="Search by name or email..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredIPs.length === 0 ? (
                              <p className="p-4 text-sm text-gray-500 text-center">No eligible parents found.</p>
                            ) : filteredIPs.map(ip => {
                              const details = getIPDetails(ip);
                              return (
                              <div
                                key={ip.id}
                                onClick={() => setSelectedIP(ip)}
                                className={`p-3 border-b border-rose-100/40 dark:border-white/5 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors ${
                                  selectedIP?.id === ip.id ? 'bg-purple-100 dark:bg-purple-900/30 border-l-4 border-l-purple-500' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{getFullName(ip)}</p>
                                    <p className="text-xs text-gray-500">{ip.email}</p>
                                  </div>
                                  <Badge color="green" size="sm">Eligible</Badge>
                                </div>
                                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                  <span><i className="ri-map-pin-line mr-0.5"></i>{details.location}</span>
                                  <span><i className="ri-calendar-line mr-0.5"></i>{details.timeline}</span>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Side-by-Side Comparison View */}
                      {selectedGC && selectedIP && (
                        <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 rounded-xl p-5 border border-green-200 dark:border-green-700">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <i className="ri-checkbox-circle-fill text-green-600"></i>
                            Side-by-Side Comparison
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-white/10">
                                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Category</th>
                                  <th className="text-left py-2 px-3 text-pink-600 dark:text-pink-400 font-medium">Surrogate (GC)</th>
                                  <th className="text-left py-2 px-3 text-purple-600 dark:text-purple-400 font-medium">Intended Parent (IP)</th>
                                </tr>
                              </thead>
                              <tbody className="text-gray-700 dark:text-gray-300">
                                <tr className="border-b border-rose-100/40 dark:border-white/5">
                                  <td className="py-2 px-3 text-gray-500">Name</td>
                                  <td className="py-2 px-3 font-medium">{getFullName(selectedGC)}</td>
                                  <td className="py-2 px-3 font-medium">{getFullName(selectedIP)}</td>
                                </tr>
                                <tr className="border-b border-rose-100/40 dark:border-white/5">
                                  <td className="py-2 px-3 text-gray-500">Location</td>
                                  <td className="py-2 px-3">{getGCDetails(selectedGC).location}</td>
                                  <td className="py-2 px-3">{getIPDetails(selectedIP).location}</td>
                                </tr>
                                <tr className="border-b border-rose-100/40 dark:border-white/5">
                                  <td className="py-2 px-3 text-gray-500">Clearance</td>
                                  <td className="py-2 px-3">
                                    <Badge color={getGCDetails(selectedGC).clearance === 'Cleared' ? 'green' : 'yellow'} size="sm">
                                      {getGCDetails(selectedGC).clearance}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3">
                                    <Badge color="green" size="sm">Accepted</Badge>
                                  </td>
                                </tr>
                                <tr className="border-b border-rose-100/40 dark:border-white/5">
                                  <td className="py-2 px-3 text-gray-500"># Pregnancies</td>
                                  <td className="py-2 px-3">{getGCDetails(selectedGC).pregnancies}</td>
                                  <td className="py-2 px-3 text-gray-400">—</td>
                                </tr>
                                <tr className="border-b border-rose-100/40 dark:border-white/5">
                                  <td className="py-2 px-3 text-gray-500">Timeline</td>
                                  <td className="py-2 px-3 text-gray-400">Available</td>
                                  <td className="py-2 px-3">{getIPDetails(selectedIP).timeline}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 text-gray-500">Flags</td>
                                  <td className="py-2 px-3 text-green-600">None</td>
                                  <td className="py-2 px-3 text-green-600">None</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                            <i className="ri-checkbox-circle-fill"></i>
                            Both candidates are eligible for matching. Eligibility validated.
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Internal Notes (Optional)
                        </label>
                        <textarea
                          value={newMatchNotes}
                          onChange={(e) => setNewMatchNotes(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                          placeholder="Add coordination notes about this match..."
                        ></textarea>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button
                          color="blue"
                          className="flex-1"
                          onClick={handleCreateMatch}
                          disabled={isCreating || !selectedGC || !selectedIP}
                        >
                          {isCreating ? (
                            <><i className="ri-loader-4-line animate-spin mr-2"></i>Creating...</>
                          ) : (
                            <><i className="ri-links-line mr-2"></i>Create Match (Proposed)</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmationDialog
        isOpen={showDeleteMatchDialog && !!selectedMatch}
        onClose={() => !isDeletingMatch && setShowDeleteMatchDialog(false)}
        onConfirm={() => {
          void handleConfirmDeleteMatch();
        }}
        title="Delete match?"
        message={
          selectedMatch?.journeyId
            ? 'This will permanently delete this match, its journey, and related records (tasks, appointments, payments, conversations, etc.). This cannot be undone.'
            : 'This will permanently delete this match. This cannot be undone.'
        }
        confirmLabel="Delete match"
        isDestructive
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default MatchesPage;
