import React, { useState, useEffect, useMemo } from 'react';
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
  'MR Review',
  'Accepted',
  'Active',
  'Delivered',
  'Escrow Closure',
  'Completed',
  'Cancelled',
];

const CHECKLIST_ITEMS = [
  { id: 'records_review_in_progress', label: 'Records Review In Progress' },
  { id: 'records_review_complete', label: 'Records Review Complete' },
  { id: 'match_meeting_pending', label: 'Match Meeting Pending' },
  { id: 'match_meeting_complete', label: 'Match Meeting Complete' },
  { id: 'match_confirmed', label: 'Match Confirmed' },
  { id: 'match_declined', label: 'Match Declined' }
];

// Valid transitions for UI guardrails
const VALID_TRANSITIONS: Record<string, MatchStatus[]> = {
  'Proposed':       ['Presented', 'Cancelled', 'Accepted'],
  'Presented':      ['MR Review', 'Accepted', 'Cancelled'],
  'MR Review':      ['Accepted', 'Cancelled'],
  'Accepted':       ['Active', 'Cancelled'],
  'Active':         ['Delivered', 'Cancelled'],
  'Delivered':      ['Escrow Closure', 'Cancelled'],
  'Escrow Closure': ['Completed', 'Cancelled'],
  'Completed':      [],
  'Cancelled':      []
};

const MatchesPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<MatchStatus | 'All'>('All');
  
  const [isUpdatingMatchStatus, setIsUpdatingMatchStatus] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create match modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleGCs, setEligibleGCs] = useState<User[]>([]);
  const [eligibleIPs, setEligibleIPs] = useState<User[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [selectedGC, setSelectedGC] = useState<User | null>(null);
  const [selectedIP, setSelectedIP] = useState<User | null>(null);
  const [newMatchNotes, setNewMatchNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Status with additional data modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<MatchStatus | null>(null);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);

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

  const handleStatusChangeRequest = (newStatus: MatchStatus) => {
    if (!selectedMatch) return;

    if (newStatus === 'Active') {
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

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!selectedMatch?.id) return;
    
    const currentData = selectedMatch.data || {};
    const currentChecklist = currentData.checklist || {};
    const newValue = !currentChecklist[itemId];
    
    const updatedChecklist = { ...currentChecklist, [itemId]: newValue };
    const updatedData = { ...currentData, checklist: updatedChecklist };

    try {
      await matchService.updateMatchData(selectedMatch.id, updatedData);
      
      const newSelected = { ...selectedMatch, data: updatedData };
      setSelectedMatch(newSelected);
      setMatches(prev => prev.map(m => m.id === selectedMatch.id ? newSelected : m));

      // Auto-activate if match_confirmed is checked
      if (itemId === 'match_confirmed' && newValue && selectedMatch.status !== 'Active' && !selectedMatch.journeyId) {
          handleActivateMatch();
      }
    } catch (error: any) {
      setToast({ message: 'Failed to update checklist', type: 'error' });
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

  const handleConfirmUnmatch = async () => {
    if (!selectedMatch?.id) return;
    setIsUnmatching(true);
    try {
      await matchService.deleteMatch(selectedMatch.id);
      setMatches(prev => prev.filter(m => m.id !== selectedMatch.id));
      setSelectedMatch(null);
      setShowUnmatchDialog(false);
      setToast({ message: 'Match removed successfully.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to unmatch', type: 'error' });
    } finally {
      setIsUnmatching(false);
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

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active') return <Badge color="green">{status}</Badge>;
    if (s === 'proposed') return <Badge color="blue">{status}</Badge>;
    if (s === 'presented') return <Badge color="purple">{status}</Badge>;
    if (s === 'mr review') return <Badge color="orange">{status}</Badge>;
    if (s === 'accepted') return <Badge color="indigo">{status}</Badge>;
    if (s === 'delivered') return <Badge color="emerald">{status}</Badge>;
    if (s === 'cancelled') return <Badge color="red">{status}</Badge>;
    if (s === 'completed') return <Badge color="gray">{status}</Badge>;
    return <Badge color="gray">{status}</Badge>;
  };

  const getDerivedStatus = (match: Match) => {
    if (match.journeyId && match.status !== 'Cancelled' && match.status !== 'Delivered' && match.status !== 'Completed') {
      return 'Active';
    }
    return match.status;
  };

  const filteredMatches = useMemo(() => {
    if (activeTab === 'All') return matches;
    return matches.filter(m => getDerivedStatus(m) === activeTab);
  }, [matches, activeTab]);

  const getAvailableTransitions = (status: MatchStatus) => {
    return VALID_TRANSITIONS[status] || [];
  };

  const filteredGCs = useMemo(() => {
    if (!gcSearch) return eligibleGCs;
    const s = gcSearch.toLowerCase();
    return eligibleGCs.filter(gc => 
      getFullName(gc).toLowerCase().includes(s) || 
      gc.email.toLowerCase().includes(s)
    );
  }, [eligibleGCs, gcSearch]);

  const filteredIPs = useMemo(() => {
    if (!ipSearch) return eligibleIPs;
    const s = ipSearch.toLowerCase();
    return eligibleIPs.filter(ip => 
      getFullName(ip).toLowerCase().includes(s) || 
      ip.email.toLowerCase().includes(s)
    );
  }, [eligibleIPs, ipSearch]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Match Management</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">Coordinate candidates, track proposed matches, and initiate journeys.</p>
            </div>
            <Button color="blue" onClick={handleOpenCreateModal}>
              <i className="ri-add-line mr-2"></i> Create New Match
            </Button>
          </div>

          <div className="flex overflow-x-auto border-b border-rose-100/60 dark:border-white/5 mb-8 no-scrollbar">
            <button
              onClick={() => setActiveTab('All')}
              className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap uppercase tracking-widest ${activeTab === 'All' ? 'border-rose-500 text-rose-600 dark:text-rose-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              All Matches
            </button>
            {MATCH_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap uppercase tracking-widest ${activeTab === status ? 'border-rose-500 text-rose-600 dark:text-rose-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {status}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-rose-500"></i>
            </div>
          ) : filteredMatches.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-links-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No matches found</h3>
              <p className="text-sm text-gray-500 mt-1">There are no matches currently in the "${activeTab}" state.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMatches.map((match) => (
                <Card 
                  key={match.id} 
                  className={`hover:shadow-lg transition-all cursor-pointer border-t-4 ${
                    match.status === 'Active' ? 'border-t-emerald-500' : 
                    match.status === 'Proposed' ? 'border-t-blue-500' : 
                    match.status === 'MR Review' ? 'border-t-orange-500' : 
                    'border-t-gray-200 dark:border-t-white/10'
                  }`}
                  onClick={() => setSelectedMatch(match)}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Match ID</p>
                      <p className="text-xs font-mono text-gray-500">{match.id.split('-')[0]}</p>
                    </div>
                    {getStatusBadge(getDerivedStatus(match))}
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 flex-shrink-0">
                        <i className="ri-user-heart-line text-xl"></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Surrogate</p>
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">{getFullName(match.gestationalCarrierData)}</h4>
                      </div>
                    </div>

                    <div className="flex items-center justify-center relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-dashed border-rose-200 dark:border-white/10"></div>
                      </div>
                      <div className="relative w-8 h-8 rounded-full bg-rose-50 dark:bg-white/5 border border-rose-200 dark:border-white/10 flex items-center justify-center text-rose-400">
                        <i className="ri-links-line text-xs"></i>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                        <i className="ri-parent-line text-xl"></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Intended Parent</p>
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">{getFullName(match.intendedParentData)}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                      <i className="ri-calendar-line"></i>
                      {formatMMDDYYYY(match.createdAt)}
                    </div>
                    {match.journeyId && (
                       <Badge color="emerald" variant="outline" className="text-[9px]">
                         <i className="ri-rocket-line mr-1"></i> Journey Active
                       </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* MATCH DETAILS DRAWER / MODAL                                        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {selectedMatch && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-[#15111f] rounded-[2rem] max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-rose-100/20 dark:border-white/5">
                <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                      <i className="ri-links-line text-2xl"></i>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Match Overview</h2>
                      <div className="mt-1">{getStatusBadge(getDerivedStatus(selectedMatch))}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMatch(null)}
                    className="w-12 h-12 rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center text-gray-500 transition-all"
                  >
                    <i className="ri-close-line text-2xl"></i>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Candidate Profiles */}
                    <div className="lg:col-span-2 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Surrogate Detailed Card */}
                        <div className="p-6 rounded-3xl bg-pink-50/30 dark:bg-pink-500/5 border border-pink-100/50 dark:border-pink-500/10">
                          <h4 className="font-bold text-pink-600 dark:text-pink-400 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
                            <i className="ri-user-heart-line"></i> Surrogate
                          </h4>
                          <div className="space-y-4">
                            <div>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{getFullName(selectedMatch.gestationalCarrierData)}</p>
                                <p className="text-sm text-gray-500">{selectedMatch.gestationalCarrierData?.email}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-pink-100/50 dark:border-pink-500/10">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-pink-500/70">Location</p>
                                    <p className="text-sm font-medium">{getGCDetails(selectedMatch.gestationalCarrierData).location}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-pink-500/70">Clearance</p>
                                    <Badge color="green" size="sm">{getGCDetails(selectedMatch.gestationalCarrierData).clearance}</Badge>
                                </div>
                            </div>
                          </div>
                        </div>

                        {/* Intended Parent Detailed Card */}
                        <div className="p-6 rounded-3xl bg-blue-50/30 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10">
                          <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
                            <i className="ri-parent-line"></i> Intended Parent
                          </h4>
                          <div className="space-y-4">
                             <div>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{getFullName(selectedMatch.intendedParentData)}</p>
                                <p className="text-sm text-gray-500">{selectedMatch.intendedParentData?.email}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100/50 dark:border-blue-500/10">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-blue-500/70">Location</p>
                                    <p className="text-sm font-medium">{getIPDetails(selectedMatch.intendedParentData).location}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-blue-500/70">Timeline</p>
                                    <p className="text-sm font-medium">{getIPDetails(selectedMatch.intendedParentData).timeline}</p>
                                </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Journey Checklist */}
                      <div className="p-8 rounded-3xl bg-white dark:bg-white/5 border border-rose-100 dark:border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <i className="ri-list-check-3 text-rose-500"></i> Match Progression Checklist
                            </h3>
                            {selectedMatch.journeyId && (
                                <Badge color="green"><i className="ri-rocket-line mr-1"></i> Journey Created</Badge>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {CHECKLIST_ITEMS.map((item) => {
                                const isChecked = !!selectedMatch.data?.checklist?.[item.id];
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleToggleChecklistItem(item.id)}
                                        className={`flex items-center gap-3 p-4 rounded-2xl transition-all border ${
                                            isChecked 
                                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400' 
                                            : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:border-rose-200'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                                            isChecked 
                                            ? 'bg-rose-500 border-rose-500 text-white' 
                                            : 'border-gray-300 dark:border-white/20'
                                        }`}>
                                            {isChecked && <i className="ri-check-line"></i>}
                                        </div>
                                        <span className="font-semibold text-sm">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {selectedMatch.data?.checklist?.match_confirmed && !selectedMatch.journeyId && (
                            <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-3 animate-pulse">
                                <i className="ri-information-line text-xl"></i>
                                <p className="font-bold">Match confirmed! The system will now automatically generate the active Journey.</p>
                            </div>
                        )}
                      </div>

                      {/* Agency Notes */}
                      <div className="space-y-4">
                        <h4 className="font-bold flex items-center gap-2"><i className="ri-sticky-note-line"></i> Agency Match Notes</h4>
                        <div className="p-6 rounded-3xl bg-amber-50/50 dark:bg-white/5 border border-amber-100/50 dark:border-white/10 text-gray-700 dark:text-gray-300 italic min-h-[100px]">
                          {selectedMatch.agencyNotes || 'No notes added to this match.'}
                        </div>
                      </div>
                    </div>

                    {/* Right Panel: Controls */}
                    <div className="space-y-6">
                      <Card className="border-none bg-rose-50/30 dark:bg-white/5 backdrop-blur-xl p-6 rounded-3xl">
                        <h4 className="font-bold mb-6 flex items-center gap-2"><i className="ri-settings-line"></i> Match Actions</h4>
                        
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Transition To</p>
                          {getAvailableTransitions(selectedMatch.status).map((nextStatus) => {
                             const isCancel = nextStatus === 'Cancelled';
                             return (
                               <Button
                                 key={nextStatus}
                                 size="sm"
                                 color={isCancel ? 'red' : 'blue'}
                                 className="w-full text-left justify-start py-3 rounded-2xl"
                                 onClick={() => handleStatusChangeRequest(nextStatus)}
                                 disabled={isUpdatingMatchStatus}
                               >
                                 <i className={`${isCancel ? 'ri-close-circle-line' : 'ri-arrow-right-circle-line'} mr-2`}></i>
                                 Set as {nextStatus}
                               </Button>
                             );
                          })}

                          {selectedMatch.status === 'Accepted' && !selectedMatch.journeyId && (
                            <Button
                              size="sm"
                              color="green"
                              className="w-full justify-start py-3 rounded-2xl"
                              onClick={handleActivateMatch}
                              disabled={isActivating}
                            >
                              {isActivating ? (
                                <><i className="ri-loader-4-line animate-spin mr-2"></i>Starting Journey...</>
                              ) : (
                                <><i className="ri-rocket-line mr-2"></i>Create Journey & Activate</>
                              )}
                            </Button>
                          )}
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/10">
                            <Button
                                variant="outline"
                                color="red"
                                className="w-full justify-start py-3 rounded-2xl border-dashed"
                                onClick={() => setShowUnmatchDialog(true)}
                                disabled={isUnmatching}
                            >
                                <i className="ri-delete-bin-line mr-2"></i> Unmatch Candidates
                            </Button>
                        </div>
                      </Card>
                      
                      <div className="p-6 rounded-3xl bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                          <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Match Information</p>
                          <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                  <span className="text-gray-500">Coordinator</span>
                                  <span className="font-bold">{authUser?.id === selectedMatch.coordinatorId ? 'Me' : 'Agency'}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span className="text-gray-500">Proposed</span>
                                  <span className="font-bold">{formatMMDDYYYY(selectedMatch.createdAt)}</span>
                              </div>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Match Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
               <div className="bg-white dark:bg-[#15111f] rounded-[2.5rem] max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-rose-100/20 dark:border-white/5">
                  <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Propose New Match</h2>
                        <p className="text-sm text-gray-500">Select candidates to pair together for a new family journey.</p>
                     </div>
                     <button onClick={() => setShowCreateModal(false)} className="w-12 h-12 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center text-gray-500 transition-all">
                        <i className="ri-close-line text-2xl"></i>
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Surrogate Selection */}
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                              <h3 className="font-bold text-lg flex items-center gap-2"><i className="ri-user-heart-line text-rose-500"></i> Select Surrogate</h3>
                              <div className="relative w-48">
                                 <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={gcSearch}
                                    onChange={(e) => setGcSearch(e.target.value)}
                                    className="w-full bg-rose-50/50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-xs focus:ring-rose-500"
                                 />
                              </div>
                           </div>
                           <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {filteredGCs.map(gc => (
                                 <div 
                                    key={gc.id} 
                                    onClick={() => setSelectedGC(gc)}
                                    className={`p-4 rounded-2xl transition-all border cursor-pointer ${selectedGC?.id === gc.id ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-rose-200'}`}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${selectedGC?.id === gc.id ? 'bg-white/20' : 'bg-rose-500/10 text-rose-500'}`}>
                                          {getFullName(gc)[0]}
                                       </div>
                                       <div>
                                          <p className="font-bold text-sm leading-tight">{getFullName(gc)}</p>
                                          <p className={`text-[10px] mt-0.5 ${selectedGC?.id === gc.id ? 'text-white/70' : 'text-gray-400'}`}>{getGCDetails(gc).location}</p>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        {/* Intended Parent Selection */}
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                              <h3 className="font-bold text-lg flex items-center gap-2"><i className="ri-parent-line text-blue-500"></i> Select Intended Parent</h3>
                              <div className="relative w-48">
                                 <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={ipSearch}
                                    onChange={(e) => setIpSearch(e.target.value)}
                                    className="w-full bg-blue-50/50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-xs focus:ring-blue-500"
                                 />
                              </div>
                           </div>
                           <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {filteredIPs.map(ip => (
                                 <div 
                                    key={ip.id} 
                                    onClick={() => setSelectedIP(ip)}
                                    className={`p-4 rounded-2xl transition-all border cursor-pointer ${selectedIP?.id === ip.id ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-blue-200'}`}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${selectedIP?.id === ip.id ? 'bg-white/20' : 'bg-blue-500/10 text-blue-500'}`}>
                                          {getFullName(ip)[0]}
                                       </div>
                                       <div>
                                          <p className="font-bold text-sm leading-tight">{getFullName(ip)}</p>
                                          <p className={`text-[10px] mt-0.5 ${selectedIP?.id === ip.id ? 'text-white/70' : 'text-gray-400'}`}>{getIPDetails(ip).location}</p>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="mt-12 p-8 rounded-[2rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                           <i className="ri-chat-1-line text-rose-500"></i>
                           <h4 className="font-bold">Match Notes</h4>
                        </div>
                        <textarea 
                           className="w-full bg-white dark:bg-[#0e0b1a] border-gray-200 dark:border-white/10 rounded-[1.5rem] p-6 text-sm focus:ring-rose-500 transition-all outline-none"
                           placeholder="Add internal notes about why these two were matched..."
                           rows={4}
                           value={newMatchNotes}
                           onChange={(e) => setNewMatchNotes(e.target.value)}
                        />
                     </div>
                  </div>

                  <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-end gap-4">
                     <Button variant="outline" className="px-8 rounded-2xl" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                     <Button 
                        color="blue" 
                        className="px-12 rounded-2xl" 
                        onClick={handleCreateMatch} 
                        disabled={isCreating || !selectedGC || !selectedIP}
                     >
                        {isCreating ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-links-line mr-2"></i>}
                        Create & Propose Match
                     </Button>
                  </div>
               </div>
            </div>
          )}

          {/* Cancellation/Delivery Reason Modal */}
          {showStatusModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
               <div className="bg-white dark:bg-[#15111f] rounded-[2rem] max-w-md w-full shadow-2xl border border-rose-100/20 dark:border-white/5">
                  <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                     <h3 className="font-bold text-lg">{pendingStatus === 'Delivered' ? 'Confirm Delivery' : 'Cancel Match'}</h3>
                     <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line text-xl"></i></button>
                  </div>
                  <div className="p-6 space-y-4">
                     {pendingStatus === 'Delivered' ? (
                        <div>
                           <label className="block text-xs font-black uppercase text-gray-400 mb-2">Delivery Date</label>
                           <input 
                              type="date" 
                              className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-3 focus:ring-rose-500" 
                              value={deliveryDateInput}
                              onChange={(e) => setDeliveryDateInput(e.target.value)}
                           />
                        </div>
                     ) : (
                        <div>
                           <label className="block text-xs font-black uppercase text-gray-400 mb-2">Reason for Cancellation</label>
                           <textarea 
                              className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-3 focus:ring-rose-500" 
                              rows={4}
                              value={cancellationReasonInput}
                              onChange={(e) => setCancellationReasonInput(e.target.value)}
                              placeholder="Please provide a reason..."
                           />
                        </div>
                     )}
                  </div>
                  <div className="p-6 pt-0 flex gap-3">
                     <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowStatusModal(false)}>Back</Button>
                     <Button color={pendingStatus === 'Cancelled' ? 'red' : 'blue'} className="flex-1 rounded-xl" onClick={confirmStatusWithData}>Confirm</Button>
                  </div>
               </div>
            </div>
          )}

          <ConfirmationDialog
            isOpen={showUnmatchDialog && !!selectedMatch}
            onClose={() => !isUnmatching && setShowUnmatchDialog(false)}
            onConfirm={() => {
              void handleConfirmUnmatch();
            }}
            title="Unmatch candidates?"
            message="This will permanently dissolve the match and its associated data. This action cannot be undone."
            confirmLabel="Yes, Unmatch"
            isDestructive
          />

          {toast && (
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          )}
        </main>
      </div>
    </div>
  );
};

export default MatchesPage;
