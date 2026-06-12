import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase";
import { Sidebar } from "../../components/feature/Sidebar";
import Header from "../../components/feature/Header";
import Card from "../../components/base/Card";
import Button from "../../components/base/Button";
import Badge from "../../components/base/Badge";
import { journeyService, JOURNEY_STAGES, STAGE_CHECKLISTS, isStageChecklistComplete, getStageChecklistState } from "../../services/journeyService";
import type { Journey, JourneyStatus, JourneyStage } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import Toast from "../../components/base/Toast";
import ConfirmationDialog from "../../components/base/ConfirmationDialog";
import { canViewFinancials } from "../../utils/permissions";
import { formatMMDDYYYY } from "../../utils/dateFormat";
import FileUploadSection, { FileRecord } from "../../components/data/FileUploadSection";
import { STORAGE_BUCKETS } from "../../services/storageService";

// Helper type for user preview
type UserPreview = {
  id: string;
  name: string;
  email: string;
  role: string;
  location?: string;
};

const JourneysPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedStageFilter, setSelectedStageFilter] = useState<JourneyStage | JourneyStatus | 'All'>('All');
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressNotes, setProgressNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Detail view state
  const [detailSurrogate, setDetailSurrogate] = useState<UserPreview | null>(null);
  const [detailParent, setDetailParent] = useState<UserPreview | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Tab state
  const [detailTab, setDetailTab] = useState<'overview' | 'medical' | 'legal' | 'trust' | 'milestones' | 'delivery'>('overview');

  // Medical tab form state
  const [medicalClinic, setMedicalClinic] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [medicalStatus, setMedicalStatus] = useState('');
  const [isSavingMedical, setIsSavingMedical] = useState(false);

  // Legal tab form state
  const [contractStatus, setContractStatus] = useState('');
  const [legalAttorney, setLegalAttorney] = useState('');
  const [legalNotes, setLegalNotes] = useState('');
  const [isSavingLegal, setIsSavingLegal] = useState(false);

  // Milestone tab form state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [newMilestoneType, setNewMilestoneType] = useState('medical');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // Trust & Reimbursements tab form state
  const [trustFundingAmount, setTrustFundingAmount] = useState('');
  const [trustFundingDate, setTrustFundingDate] = useState('');
  const [reimbursementNotes, setReimbursementNotes] = useState('');
  const [trustStatus, setTrustStatus] = useState('');
  const [isSavingTrust, setIsSavingTrust] = useState(false);

  // Delivery tab form state
  const [eddInput, setEddInput] = useState('');
  const [deliveryHospital, setDeliveryHospital] = useState('');
  const [postpartumNotesInput, setPostpartumNotesInput] = useState('');
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);

  // Delivery date input
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');

  const [showDeleteJourneyDialog, setShowDeleteJourneyDialog] = useState(false);
  const [isDeletingJourney, setIsDeletingJourney] = useState(false);

  const fetchJourneys = async () => {
    setIsLoading(true);
    try {
      const data = await journeyService.getAllJourneys();
      setJourneys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to load journeys', type: 'error' });
      setJourneys([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJourneys();
  }, []);

  // ─── Build user preview ────────────────────────────────────────────────────
  const buildUserPreview = (data: any, role: string): UserPreview => {
    const formData = data.formData || {};
    const firstName = formData.firstName || data.first_name || data.firstName || '';
    const lastName = formData.lastName || data.last_name || data.lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || data.email || 'Unknown';
    const city = formData.city || '';
    const state = formData.state || '';
    const location = [city, state].filter(Boolean).join(', ');

    return { id: data.id, name, email: data.email || '', role, location };
  };

  const fetchUserPreview = async (id: string, role: string) => {
    if (!id) return;
    try {
      setIsDetailsLoading(true);
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error) throw error;
      if (!data) return;

      const preview = buildUserPreview(data, role);
      if (role === 'Surrogate') setDetailSurrogate(preview);
      else setDetailParent(preview);
    } catch (e) {
      console.error('Failed to load user preview', e);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJourney) {
      setDetailSurrogate(null);
      setDetailParent(null);
      setDetailTab('overview');
      fetchUserPreview(selectedJourney.gestationalCarrierId, 'Surrogate');
      fetchUserPreview(selectedJourney.intendedParentId, 'Intended Parent');

      // Load saved data into form fields
      const med = (selectedJourney.medicalRecords as any) || {};
      setMedicalClinic(med.clinicName || '');
      setMedicalNotes(med.notes || '');
      setMedicalStatus(med.status || '');

      const legal = (selectedJourney.legalAgreements as any) || {};
      setContractStatus(legal.contractStatus || '');
      setLegalAttorney(legal.attorney || '');
      setLegalNotes(legal.notes || '');

      const delivery = (selectedJourney.legalAgreements as any) || {};
      setEddInput(selectedJourney.estimatedDeliveryDate || '');
      setDeliveryHospital(delivery.hospital || '');
      setPostpartumNotesInput(
        typeof selectedJourney.postpartumNotes === 'string'
          ? selectedJourney.postpartumNotes
          : '',
      );

      const trust = (selectedJourney.journeyNotes as any)?.trust || {};
      setTrustFundingAmount(trust.fundingAmount || '');
      setTrustFundingDate(trust.fundingDate || '');
      setReimbursementNotes(trust.reimbursementNotes || '');
      setTrustStatus(trust.status || '');
    }
  }, [selectedJourney]);

  // ─── Stage Progression ─────────────────────────────────────────────────────
  const handleProgressStage = async () => {
    if (!selectedJourney) return;

    try {
      const nextStage = journeyService.getNextStage(selectedJourney.stage);
      if (!nextStage) {
        setToast({ message: 'Journey is at the final stage', type: 'error' });
        return;
      }

      // Per client review: every checklist item for the current stage must be
      // completed before advancing.
      if (!isStageChecklistComplete(selectedJourney, selectedJourney.stage as JourneyStage)) {
        setToast({
          message: `Complete the "${selectedJourney.stage}" checklist before progressing.`,
          type: 'error',
        });
        return;
      }

      const prev = (selectedJourney.journeyNotes || {}) as Record<string, unknown>;
      const notes: Record<string, unknown> = { ...prev };
      const trimmed = progressNotes.trim();
      if (trimmed) {
        const existing = typeof notes.client_notes === 'string' ? (notes.client_notes as string) : '';
        const line = `[${formatMMDDYYYY(new Date())}] ${trimmed}`;
        notes.client_notes = existing ? `${existing}\n\n${line}` : line;
        await journeyService.updateJourneyNotes(selectedJourney.id, notes);
      }

      await journeyService.updateJourneyStage(selectedJourney.id, nextStage);
      await fetchJourneys();
      setShowProgressModal(false);
      setSelectedJourney(null);
      setProgressNotes('');
      setToast({ message: `Progressed to "${nextStage}"`, type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to progress journey', type: 'error' });
    }
  };

  // ─── Stage checklist toggle ────────────────────────────────────────────────
  const handleToggleStageChecklistItem = async (itemId: string) => {
    if (!selectedJourney) return;
    const stage = selectedJourney.stage as JourneyStage;
    const current = getStageChecklistState(selectedJourney, stage);
    const updated = { ...current, [itemId]: !current[itemId] };

    // Optimistic update
    const prevNotes = (selectedJourney.journeyNotes as any) || {};
    const newNotes = {
      ...prevNotes,
      stageChecklists: { ...(prevNotes.stageChecklists || {}), [stage]: updated },
    };
    const newSelected = { ...selectedJourney, journeyNotes: newNotes } as typeof selectedJourney;
    setSelectedJourney(newSelected);
    setJourneys(prev => prev.map(j => j.id === selectedJourney.id ? newSelected : j));

    try {
      await journeyService.updateStageChecklist(selectedJourney.id, stage, updated);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update checklist', type: 'error' });
      fetchJourneys();
    }
  };

  // ─── Record Delivery ──────────────────────────────────────────────────────
  const handleRecordDelivery = async () => {
    if (!selectedJourney || !deliveryDateInput) return;

    try {
      await journeyService.updateDeliveryDate(selectedJourney.id, deliveryDateInput);
      await fetchJourneys();
      setShowDeliveryModal(false);
      setDeliveryDateInput('');
      setToast({ message: 'Delivery date recorded!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to record delivery', type: 'error' });
    }
  };

  // ─── Journey Status Actions ────────────────────────────────────────────────
  const handleCompleteJourney = async () => {
    if (!selectedJourney) return;
    try {
      await journeyService.updateJourneyStatus(selectedJourney.id, 'Completed');
      await fetchJourneys();
      setSelectedJourney(null);
      setToast({ message: 'Journey completed!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to complete journey', type: 'error' });
    }
  };

  const handleCancelJourney = async () => {
    if (!selectedJourney) return;
    try {
      await journeyService.updateJourneyStatus(selectedJourney.id, 'Cancelled');
      await fetchJourneys();
      setSelectedJourney(null);
      setToast({ message: 'Journey cancelled', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to cancel journey', type: 'error' });
    }
  };

  const handleConfirmDeleteJourney = async () => {
    if (!selectedJourney?.id) return;
    setIsDeletingJourney(true);
    try {
      await journeyService.deleteJourney(selectedJourney.id);
      setJourneys(prev => prev.filter(j => j.id !== selectedJourney.id));
      setSelectedJourney(null);
      setShowDeleteJourneyDialog(false);
      setToast({ message: 'Journey deleted successfully.', type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete journey';
      setToast({ message, type: 'error' });
    } finally {
      setIsDeletingJourney(false);
    }
  };

  const handleDocumentsChange = async (files: FileRecord[], updatedCategory?: string) => {
    if (!selectedJourney) return;
    
    let allFiles = files;
    if (updatedCategory) {
      const otherFiles = currentJourneyFiles.filter(f => f.category !== updatedCategory);
      allFiles = [...otherFiles, ...files];
    }
    
    const updatedDocuments = allFiles.map(f => {
      const existing = (selectedJourney.documents || []).find((d: any) => d.url === f.url);
      if (existing) return existing;
      
      return {
        id: crypto.randomUUID(),
        name: f.name,
        type: f.type,
        url: f.url,
        uploaded_at: f.uploadedAt,
        uploaded_by: 'admin',
        status: 'approved',
        notes: `path:${f.path}|category:${f.category}`,
        visible_to_roles: ['admin']
      };
    });

    try {
      await journeyService.updateJourneyDocuments(selectedJourney.id, updatedDocuments);
      setSelectedJourney(prev => prev ? { ...prev, documents: updatedDocuments } : null);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update documents', type: 'error' });
    }
  };

  const currentJourneyFiles: FileRecord[] = (selectedJourney?.documents || []).map((d: any) => {
    const isPathAndCategory = d.notes?.startsWith('path:');
    let path = '';
    let category: any = 'Other';
    if (isPathAndCategory) {
      const parts = d.notes.split('|');
      path = parts[0].replace('path:', '');
      category = parts[1]?.replace('category:', '') || 'Other';
    } else {
      try {
        const pathParts = d.url.split('/journeys/');
        if (pathParts.length > 1) {
          path = pathParts[1];
        }
      } catch (e) {}
    }
    return {
      name: d.name,
      url: d.url,
      category,
      uploadedAt: d.uploaded_at || new Date().toISOString(),
      type: d.type || 'application/octet-stream',
      path
    };
  });

  // ─── Tab Save Handlers ────────────────────────────────────────────────────
  const handleSaveMedical = async () => {
    if (!selectedJourney) return;
    setIsSavingMedical(true);
    try {
      await journeyService.updateMedicalRecords(selectedJourney.id, {
        clinicName: medicalClinic,
        notes: medicalNotes,
        status: medicalStatus,
        updatedAt: new Date().toISOString(),
      });
      await fetchJourneys();
      setToast({ message: 'Medical records saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save medical records', type: 'error' });
    } finally {
      setIsSavingMedical(false);
    }
  };

  const handleSaveLegal = async () => {
    if (!selectedJourney) return;
    setIsSavingLegal(true);
    try {
      await journeyService.updateLegalAgreements(selectedJourney.id, {
        contractStatus,
        attorney: legalAttorney,
        notes: legalNotes,
        updatedAt: new Date().toISOString(),
      });
      await fetchJourneys();
      setToast({ message: 'Legal information saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save legal information', type: 'error' });
    } finally {
      setIsSavingLegal(false);
    }
  };

  const handleAddMilestone = async () => {
    if (!selectedJourney || !newMilestoneTitle || !newMilestoneDate) return;
    setIsAddingMilestone(true);
    try {
      const milestone = {
        id: Date.now().toString(),
        title: newMilestoneTitle,
        date: newMilestoneDate,
        type: newMilestoneType,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await journeyService.updateMilestone(selectedJourney.id, milestone as any);
      await fetchJourneys();
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
      setNewMilestoneType('medical');
      setToast({ message: 'Milestone added', type: 'success' });
    } catch {
      setToast({ message: 'Failed to add milestone', type: 'error' });
    } finally {
      setIsAddingMilestone(false);
    }
  };

  const handleSaveTrust = async () => {
    if (!selectedJourney) return;
    setIsSavingTrust(true);
    try {
      const existingNotes = (selectedJourney.journeyNotes as any) || {};
      await journeyService.updateJourneyNotes(selectedJourney.id, {
        ...existingNotes,
        trust: {
          fundingAmount: trustFundingAmount,
          fundingDate: trustFundingDate,
          reimbursementNotes,
          status: trustStatus,
          updatedAt: new Date().toISOString(),
        },
      });
      await fetchJourneys();
      setToast({ message: 'Trust & reimbursement info saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save trust information', type: 'error' });
    } finally {
      setIsSavingTrust(false);
    }
  };

  const handleSaveDelivery = async () => {
    if (!selectedJourney) return;
    setIsSavingDelivery(true);
    try {
      if (eddInput) {
        await journeyService.updateEstimatedDeliveryDate(selectedJourney.id, eddInput);
      }
      if (postpartumNotesInput !== undefined) {
        await journeyService.updatePostpartumNotes(selectedJourney.id, postpartumNotesInput);
      }
      // Save hospital to legal_agreements for now (or we could add a dedicated field)
      const existingLegal = (selectedJourney.legalAgreements as any) || {};
      await journeyService.updateLegalAgreements(selectedJourney.id, {
        ...existingLegal,
        hospital: deliveryHospital,
      });
      await fetchJourneys();
      setToast({ message: 'Delivery info saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save delivery info', type: 'error' });
    } finally {
      setIsSavingDelivery(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatMMDDYYYY(dateStr);
  };

  const filteredJourneys = (() => {
    if (selectedStageFilter === 'All') return journeys;
    if (selectedStageFilter === 'Completed') return journeys.filter(j => j.status === 'Completed');
    if (selectedStageFilter === 'Cancelled') return journeys.filter(j => j.status === 'Cancelled');
    // Otherwise filter by stage within active journeys
    return journeys.filter(j => j.status === 'Active' && j.stage === selectedStageFilter);
  })();

  const getStageColor = (stage: string): 'blue' | 'green' | 'red' | 'yellow' | 'teal' | 'orange' => {
    switch (stage) {
      case 'Medical Screening': return 'blue';
      case 'Legal': return 'yellow';
      case 'Embryo Transfer': return 'teal';
      case 'Pregnancy': return 'green';
      case 'Birth': return 'orange';
      case 'Postpartum': return 'green';
      default: return 'blue';
    }
  };

  const getStatusColor = (status: string): 'green' | 'red' | 'blue' => {
    switch (status) {
      case 'Active': return 'green';
      case 'Completed': return 'blue';
      case 'Cancelled': return 'red';
      default: return 'blue';
    }
  };

  const stageProgress = (stage: string): number => journeyService.getStageProgress(stage);

  const allFilters = [
    { id: 'All' as const, label: 'All' },
    ...JOURNEY_STAGES.map(s => ({ id: s as JourneyStage, label: s })),
    { id: 'Completed' as JourneyStatus, label: 'Completed' },
    { id: 'Cancelled' as JourneyStatus, label: 'Cancelled' },
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journeys</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Operational case tracking. Journeys are created when a match becomes Active.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Journeys</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{journeys.length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600">{journeys.filter(j => j.status === 'Active').length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">In Pregnancy</p>
              <p className="text-2xl font-bold text-blue-600">{journeys.filter(j => j.stage === 'Pregnancy' && j.status === 'Active').length}</p>
            </div>
            <div className="bg-white dark:bg-[#15111f] rounded-2xl p-4 border border-rose-100/60 dark:border-white/5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-teal-600">{journeys.filter(j => j.status === 'Completed').length}</p>
            </div>
          </div>

          {/* Stage Filter Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {allFilters.map((filter) => {
              const count = filter.id === 'All'
                ? journeys.length
                : filter.id === 'Completed'
                ? journeys.filter(j => j.status === 'Completed').length
                : filter.id === 'Cancelled'
                ? journeys.filter(j => j.status === 'Cancelled').length
                : journeys.filter(j => j.status === 'Active' && j.stage === filter.id).length;

              return (
                <button
                  key={filter.id}
                  onClick={() => setSelectedStageFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedStageFilter === filter.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-[#15111f] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter.label} ({count})
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJourneys.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#15111f] rounded-2xl border border-dashed border-gray-300 dark:border-white/5">
                  <i className="ri-roadmap-line text-4xl text-gray-400 mb-2"></i>
                  <p className="text-gray-500 dark:text-gray-400">No journeys found.</p>
                  <p className="text-sm text-gray-400 mt-1">Journeys are auto-created when a match becomes Active.</p>
                </div>
              ) : (
                filteredJourneys.map((journey) => (
                  <Card
                    key={journey.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedJourney(journey)}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Journey #{journey.caseNumber}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Started {formatDate(journey.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge color={getStatusColor(journey.status) as any}>{journey.status}</Badge>
                          {journey.status === 'Active' && (
                            <Badge color={getStageColor(journey.stage) as any}>{journey.stage}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {journey.status === 'Active' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Stage Progress
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {stageProgress(journey.stage)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-white/5 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${stageProgress(journey.stage)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Stage Timeline */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {JOURNEY_STAGES.map((stage, index) => {
                          const currentIndex = JOURNEY_STAGES.indexOf(journey.stage as JourneyStage);
                          const isPast = index < currentIndex;
                          const isCurrent = index === currentIndex && journey.status === 'Active';

                          return (
                            <div key={stage} className="flex items-center">
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                                  isPast
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                                }`}
                                title={stage}
                              >
                                {isPast ? <i className="ri-check-line"></i> : index + 1}
                              </div>
                              {index < JOURNEY_STAGES.length - 1 && (
                                <div className={`w-8 h-0.5 ${isPast ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Delivery info */}
                      {journey.deliveryDate && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <i className="ri-heart-pulse-line"></i>
                          <span>Delivered on {formatDate(journey.deliveryDate)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* JOURNEY DETAIL MODAL                                               */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {selectedJourney && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Journey #{selectedJourney.caseNumber}
                      </h2>
                      <Badge color={getStatusColor(selectedJourney.status) as any}>{selectedJourney.status}</Badge>
                      {selectedJourney.status === 'Active' && (
                        <Badge color={getStageColor(selectedJourney.stage) as any}>{selectedJourney.stage}</Badge>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedJourney(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex border-b border-rose-100/60 dark:border-white/5 mb-6 overflow-x-auto">
                    {[
                      { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line', restricted: false },
                      { id: 'medical', label: 'Medical', icon: 'ri-heart-pulse-line', restricted: false },
                      { id: 'legal', label: 'Legal', icon: 'ri-file-text-line', restricted: false },
                      ...(canViewFinancials(profile?.role as string) ? [{ id: 'trust', label: 'Trust & Funds', icon: 'ri-safe-line', restricted: true }] : []),
                      { id: 'milestones', label: 'Milestones', icon: 'ri-flag-line', restricted: false },
                      { id: 'delivery', label: 'Delivery', icon: 'ri-heart-3-line', restricted: false },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setDetailTab(tab.id as any)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                          detailTab === tab.id
                            ? 'border-rose-500 text-rose-500 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <i className={`${tab.icon} mr-1.5`}></i>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="bg-rose-50/50 dark:bg-white/5 p-6 rounded-xl space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Surrogate */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                                <i className="ri-user-heart-line text-pink-600 dark:text-pink-300"></i>
                              </div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">Surrogate</h4>
                            </div>
                            {isDetailsLoading && !detailSurrogate ? (
                              <div className="animate-pulse pl-10 space-y-2">
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                              </div>
                            ) : detailSurrogate ? (
                              <div className="pl-10">
                                <p className="text-lg font-medium text-gray-900 dark:text-white">{detailSurrogate.name}</p>
                                {detailSurrogate.email && <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><i className="ri-mail-line"></i> {detailSurrogate.email}</p>}
                                {detailSurrogate.location && <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><i className="ri-map-pin-line"></i> {detailSurrogate.location}</p>}
                              </div>
                            ) : <p className="pl-10 text-gray-500 italic">Not found</p>}
                          </div>
                          {/* Intended Parent */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <i className="ri-parent-line text-blue-600 dark:text-blue-300"></i>
                              </div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">Intended Parent</h4>
                            </div>
                            {isDetailsLoading && !detailParent ? (
                              <div className="animate-pulse pl-10 space-y-2">
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                              </div>
                            ) : detailParent ? (
                              <div className="pl-10">
                                <p className="text-lg font-medium text-gray-900 dark:text-white">{detailParent.name}</p>
                                {detailParent.email && <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><i className="ri-mail-line"></i> {detailParent.email}</p>}
                                {detailParent.location && <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"><i className="ri-map-pin-line"></i> {detailParent.location}</p>}
                              </div>
                            ) : <p className="pl-10 text-gray-500 italic">Not found</p>}
                          </div>
                        </div>
                        <hr className="border-rose-100/60 dark:border-white/5" />
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Started</h4>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedJourney.createdAt)}</p>
                          </div>
                          {selectedJourney.estimatedDeliveryDate && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">EDD</h4>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedJourney.estimatedDeliveryDate)}</p>
                            </div>
                          )}
                          {selectedJourney.deliveryDate && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Delivered</h4>
                              <p className="text-sm font-medium text-green-600">{formatDate(selectedJourney.deliveryDate)}</p>
                            </div>
                          )}
                        </div>
                        {selectedJourney.deliveryDate && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                            <i className="ri-heart-pulse-line text-lg"></i>
                            <span className="font-medium">Baby delivered on {formatDate(selectedJourney.deliveryDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-rose-100/60 dark:border-white/5">
                          <i className="ri-links-line text-lg text-blue-500"></i>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Linked Match</p>
                            <p className="text-xs text-gray-500">Match ID: {selectedJourney.matchId?.slice(0, 8) || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stage Progression Checklist */}
                      {selectedJourney.status === 'Active' && (STAGE_CHECKLISTS[selectedJourney.stage as JourneyStage] || []).length > 0 && (
                        <div className="p-4 rounded-xl border border-rose-100/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <i className="ri-list-check-2 text-rose-500"></i>
                              {selectedJourney.stage} checklist
                            </h4>
                            {isStageChecklistComplete(selectedJourney, selectedJourney.stage as JourneyStage) ? (
                              <Badge color="green">Complete</Badge>
                            ) : (
                              <Badge color="yellow">In progress</Badge>
                            )}
                          </div>
                          <div className="space-y-2">
                            {(STAGE_CHECKLISTS[selectedJourney.stage as JourneyStage] || []).map((item) => {
                              const checked = !!getStageChecklistState(selectedJourney, selectedJourney.stage as JourneyStage)[item.id];
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => handleToggleStageChecklistItem(item.id)}
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${checked ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:border-rose-200'}`}
                                >
                                  <span className={`w-5 h-5 rounded flex items-center justify-center border-2 ${checked ? 'bg-rose-500 border-rose-500 text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                    {checked && <i className="ri-check-line text-xs"></i>}
                                  </span>
                                  <span className="text-sm font-medium">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {journeyService.getNextStage(selectedJourney.stage) && !isStageChecklistComplete(selectedJourney, selectedJourney.stage as JourneyStage) && (
                            <p className="mt-3 text-[11px] text-gray-400 flex items-center gap-1">
                              <i className="ri-information-line"></i>
                              Complete all items to unlock progressing to {journeyService.getNextStage(selectedJourney.stage)}.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Stage Actions */}
                      {selectedJourney.status === 'Active' && (
                        <div className="flex flex-wrap gap-3">
                          {journeyService.getNextStage(selectedJourney.stage) ? (
                            <Button
                              color="blue"
                              className="flex-1"
                              onClick={() => setShowProgressModal(true)}
                              disabled={!isStageChecklistComplete(selectedJourney, selectedJourney.stage as JourneyStage)}
                              title={!isStageChecklistComplete(selectedJourney, selectedJourney.stage as JourneyStage) ? `Complete the ${selectedJourney.stage} checklist first` : undefined}
                            >
                              <i className="ri-arrow-right-line mr-2"></i>
                              Progress to {journeyService.getNextStage(selectedJourney.stage)}
                            </Button>
                          ) : (
                            <div className="flex-1 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-center font-medium text-sm">
                              <i className="ri-check-double-line mr-2"></i>Final stage reached
                            </div>
                          )}
                          {(selectedJourney.stage === 'Birth' || selectedJourney.stage === 'Postpartum') && !selectedJourney.deliveryDate && (
                            <Button color="green" onClick={() => { setDeliveryDateInput(''); setShowDeliveryModal(true); }}>
                              <i className="ri-heart-pulse-line mr-2"></i>Record Delivery Date
                            </Button>
                          )}
                          <Button color="red" variant="outline" onClick={handleCancelJourney}>
                            <i className="ri-close-circle-line mr-2"></i>Cancel Journey
                          </Button>
                        </div>
                      )}
                      {selectedJourney.status === 'Active' && selectedJourney.stage === 'Postpartum' && selectedJourney.deliveryDate && (
                        <Button color="teal" className="w-full" onClick={handleCompleteJourney}>
                          <i className="ri-checkbox-circle-line mr-2"></i>Complete Journey
                        </Button>
                      )}

                      <div className="pt-4 border-t border-rose-100/60 dark:border-white/5">
                        <Button
                          color="red"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => setShowDeleteJourneyDialog(true)}
                        >
                          <i className="ri-delete-bin-line mr-2"></i>
                          Delete journey
                        </Button>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Removes this journey and related tasks, appointments, payments, and conversations. The match remains; its journey link is cleared.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── MEDICAL TAB ──────────────────────────────────────────── */}
                  {detailTab === 'medical' && (
                    <div className="space-y-5">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        <i className="ri-information-line mr-1"></i>
                        Post-match medical tracking. Pre-screen records are managed on the GC profile.
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic / Provider Name</label>
                        <input
                          type="text"
                          value={medicalClinic}
                          onChange={e => setMedicalClinic(e.target.value)}
                          placeholder="e.g. Pacific Fertility Center"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Medical Status</label>
                        <select
                          value={medicalStatus}
                          onChange={e => setMedicalStatus(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        >
                          <option value="">Select status...</option>
                          <option value="Pre-Screening">Pre-Screening</option>
                          <option value="Cycle Monitoring">Cycle Monitoring</option>
                          <option value="Embryo Transfer Scheduled">Embryo Transfer Scheduled</option>
                          <option value="Beta Testing">Beta Testing</option>
                          <option value="Confirmed Pregnant">Confirmed Pregnant</option>
                          <option value="Ongoing Prenatal Care">Ongoing Prenatal Care</option>
                          <option value="Post-Delivery">Post-Delivery</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Medical Notes</label>
                        <textarea
                          value={medicalNotes}
                          onChange={e => setMedicalNotes(e.target.value)}
                          rows={5}
                          placeholder="Clinic appointments, test results, cycle notes, embryo transfer details..."
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        />
                      </div>
                      <div className="pt-6 border-t border-gray-200 dark:border-white/10 mt-6">
                        <FileUploadSection
                          title="Medical Documents"
                          description="Upload medical reports, lab results, and screening records for this journey."
                          userId={selectedJourney.id}
                          bucket={STORAGE_BUCKETS.JOURNEYS}
                          defaultCategory="Medical"
                          files={currentJourneyFiles.filter(f => f.category === 'Medical')}
                          onFilesChange={(files) => handleDocumentsChange(files, 'Medical')}
                        />
                      </div>
                      
                      <Button color="blue" className="w-full" onClick={handleSaveMedical} disabled={isSavingMedical}>
                        {isSavingMedical ? <><i className="ri-loader-4-line animate-spin mr-2"></i>Saving...</> : <><i className="ri-save-line mr-2"></i>Save Medical Records</>}
                      </Button>
                    </div>
                  )}

                  {/* ── LEGAL TAB ─────────────────────────────────────────────── */}
                  {detailTab === 'legal' && (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contract Status</label>
                        <select
                          value={contractStatus}
                          onChange={e => setContractStatus(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        >
                          <option value="">Select status...</option>
                          <option value="Not Started">Not Started</option>
                          <option value="Draft in Review">Draft in Review</option>
                          <option value="Sent for Signatures">Sent for Signatures</option>
                          <option value="GC Signed">GC Signed</option>
                          <option value="IP Signed">IP Signed</option>
                          <option value="Fully Executed">Fully Executed</option>
                          <option value="Amendments Needed">Amendments Needed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attorney / Law Firm</label>
                        <input
                          type="text"
                          value={legalAttorney}
                          onChange={e => setLegalAttorney(e.target.value)}
                          placeholder="e.g. Smith & Associates"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legal Notes</label>
                        <textarea
                          value={legalNotes}
                          onChange={e => setLegalNotes(e.target.value)}
                          rows={5}
                          placeholder="Contract milestones, attorney correspondence, outstanding items..."
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        />
                      </div>
                      {selectedJourney.legalAgreements && (contractStatus || legalNotes) && (
                        <div className="p-4 bg-rose-50/50 dark:bg-white/5 rounded-lg">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Last Saved</p>
                          {contractStatus && <p className="text-sm text-gray-700 dark:text-gray-300">Contract: <span className="font-medium">{contractStatus}</span></p>}
                          {legalAttorney && <p className="text-sm text-gray-700 dark:text-gray-300">Attorney: {legalAttorney}</p>}
                        </div>
                      )}

                      <div className="pt-6 border-t border-gray-200 dark:border-white/10 mt-6">
                        <FileUploadSection
                          title="Legal Documents"
                          description="Upload legal agreements, contracts, and other legal records for this journey."
                          userId={selectedJourney.id}
                          bucket={STORAGE_BUCKETS.JOURNEYS}
                          defaultCategory="Legal"
                          files={currentJourneyFiles.filter(f => f.category === 'Legal')}
                          onFilesChange={(files) => handleDocumentsChange(files, 'Legal')}
                        />
                      </div>
                      
                      <Button color="blue" className="w-full" onClick={handleSaveLegal} disabled={isSavingLegal}>
                        {isSavingLegal ? <><i className="ri-loader-4-line animate-spin mr-2"></i>Saving...</> : <><i className="ri-save-line mr-2"></i>Save Legal Information</>}
                      </Button>
                    </div>
                  )}

                  {/* ── TRUST & REIMBURSEMENTS TAB ───────────────────────────────── */}
                  {detailTab === 'trust' && (
                    canViewFinancials(profile?.role as string) ? (
                      <div className="space-y-5">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                          <i className="ri-lock-line mr-1"></i>
                          Restricted — visible to Admin and Finance roles only.
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trust Funding Status</label>
                            <select
                              value={trustStatus}
                              onChange={e => setTrustStatus(e.target.value)}
                              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                            >
                              <option value="">Select status...</option>
                              <option value="Not Funded">Not Funded</option>
                              <option value="Partially Funded">Partially Funded</option>
                              <option value="Fully Funded">Fully Funded</option>
                              <option value="Funds Released">Funds Released</option>
                              <option value="Escrow Closed">Escrow Closed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trust Funding Date</label>
                            <input
                              type="date"
                              value={trustFundingDate}
                              onChange={e => setTrustFundingDate(e.target.value)}
                              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trust Funding Amount ($)</label>
                          <input
                            type="text"
                            value={trustFundingAmount}
                            onChange={e => setTrustFundingAmount(e.target.value)}
                            placeholder="e.g. 45,000"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reimbursement Notes</label>
                          <textarea
                            value={reimbursementNotes}
                            onChange={e => setReimbursementNotes(e.target.value)}
                            rows={4}
                            placeholder="Outstanding reimbursements, disbursement history, escrow instructions..."
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                          />
                        </div>
                        <Button color="blue" className="w-full" onClick={handleSaveTrust} disabled={isSavingTrust}>
                          {isSavingTrust ? <><i className="ri-loader-4-line animate-spin mr-2"></i>Saving...</> : <><i className="ri-save-line mr-2"></i>Save Trust & Reimbursement Info</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <i className="ri-lock-line text-3xl mb-2"></i>
                        <p>You do not have permission to view financial data.</p>
                      </div>
                    )
                  )}

                  {/* ── MILESTONES TAB ─────────────────────────────────────────── */}
                  {detailTab === 'milestones' && (
                    <div className="space-y-6">
                      {/* Existing milestones */}
                      {(() => {
                        const notes = (selectedJourney.journeyNotes as any) || {};
                        const milestones: any[] = notes.milestones || [];
                        return milestones.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Milestones ({milestones.length})</h4>
                            {milestones.map((m: any) => (
                              <div key={m.id} className="flex items-start gap-3 p-3 bg-rose-50/50 dark:bg-white/5 rounded-lg">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${m.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.title}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.type} • {formatDate(m.date)}</p>
                                </div>
                                <Badge color={m.status === 'completed' ? 'green' : 'blue'}>{m.status}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-white/5 rounded-lg">
                            <i className="ri-flag-line text-3xl mb-2"></i>
                            <p className="text-sm">No milestones yet</p>
                          </div>
                        );
                      })()}

                      {/* Add milestone form */}
                      <div className="border border-rose-100/60 dark:border-white/5 rounded-xl p-4 space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Milestone</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                            <select
                              value={newMilestoneType}
                              onChange={e => setNewMilestoneType(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            >
                              <option value="medical">Medical</option>
                              <option value="legal">Legal</option>
                              <option value="pregnancy">Pregnancy</option>
                              <option value="delivery">Delivery</option>
                              <option value="financial">Financial</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                            <input
                              type="date"
                              value={newMilestoneDate}
                              onChange={e => setNewMilestoneDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                          <input
                            type="text"
                            value={newMilestoneTitle}
                            onChange={e => setNewMilestoneTitle(e.target.value)}
                            placeholder="e.g. Embryo transfer completed, Contract signed..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                        </div>
                        <Button
                          color="blue"
                          className="w-full"
                          onClick={handleAddMilestone}
                          disabled={!newMilestoneTitle || !newMilestoneDate || isAddingMilestone}
                        >
                          {isAddingMilestone ? <><i className="ri-loader-4-line animate-spin mr-2"></i>Adding...</> : <><i className="ri-add-line mr-2"></i>Add Milestone</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── DELIVERY & POSTPARTUM TAB ─────────────────────────────── */}
                  {detailTab === 'delivery' && (
                    <div className="space-y-5">
                      {selectedJourney.deliveryDate && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-3 text-green-700 dark:text-green-300">
                          <i className="ri-heart-pulse-line text-xl"></i>
                          <div>
                            <p className="font-semibold">Baby Delivered</p>
                            <p className="text-sm">{formatDate(selectedJourney.deliveryDate)}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Delivery Date (EDD)</label>
                        <input
                          type="date"
                          value={eddInput}
                          onChange={e => setEddInput(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Hospital / Location</label>
                        <input
                          type="text"
                          value={deliveryHospital}
                          onChange={e => setDeliveryHospital(e.target.value)}
                          placeholder="e.g. Cedars-Sinai Medical Center"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Postpartum Notes</label>
                        <textarea
                          value={postpartumNotesInput}
                          onChange={e => setPostpartumNotesInput(e.target.value)}
                          rows={4}
                          placeholder="Postpartum recovery notes, follow-up appointments, GC wellbeing..."
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        />
                      </div>
                      <Button color="blue" className="w-full" onClick={handleSaveDelivery} disabled={isSavingDelivery}>
                        {isSavingDelivery ? <><i className="ri-loader-4-line animate-spin mr-2"></i>Saving...</> : <><i className="ri-save-line mr-2"></i>Save Delivery Info</>}
                      </Button>
                      {!selectedJourney.deliveryDate && (selectedJourney.stage === 'Birth' || selectedJourney.stage === 'Postpartum') && (
                        <div className="border-t border-rose-100/60 dark:border-white/5 pt-4">
                          <Button color="green" className="w-full" onClick={() => { setDeliveryDateInput(''); setShowDeliveryModal(true); }}>
                            <i className="ri-heart-pulse-line mr-2"></i>Record Actual Delivery Date
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* PROGRESS STAGE MODAL                                               */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showProgressModal && selectedJourney && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Progress Stage</h2>
                    <button onClick={() => setShowProgressModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Progress from <span className="font-semibold">{selectedJourney.stage}</span> to{' '}
                        <span className="font-semibold">{journeyService.getNextStage(selectedJourney.stage)}</span>?
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notes for intended parent & surrogate (optional)
                      </label>
                      <textarea
                        value={progressNotes}
                        onChange={(e) => setProgressNotes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        placeholder="Shown in the mobile app under journey updates when you progress a stage..."
                      ></textarea>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setShowProgressModal(false)}>Cancel</Button>
                      <Button color="blue" className="flex-1" onClick={handleProgressStage}>Confirm Progress</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* DELIVERY DATE MODAL                                                */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showDeliveryModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
              <div className="bg-white dark:bg-[#15111f] rounded-2xl max-w-md w-full shadow-2xl">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record Delivery</h2>
                    <button onClick={() => setShowDeliveryModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-300">
                      <i className="ri-heart-pulse-line mr-1"></i>
                      Recording the delivery date will also update the match status.
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Delivery Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={deliveryDateInput}
                        onChange={(e) => setDeliveryDateInput(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setShowDeliveryModal(false)}>Cancel</Button>
                      <Button
                        color="green"
                        className="flex-1"
                        onClick={handleRecordDelivery}
                        disabled={!deliveryDateInput}
                      >
                        Record Delivery
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmationDialog
        isOpen={showDeleteJourneyDialog && !!selectedJourney}
        onClose={() => !isDeletingJourney && setShowDeleteJourneyDialog(false)}
        onConfirm={() => {
          void handleConfirmDeleteJourney();
        }}
        title="Delete journey?"
        message={
          selectedJourney?.matchId
            ? 'This will permanently delete this journey and related records (tasks, appointments, payments, agency financials, documents, conversations, etc.). The linked match will stay, but its journey link will be cleared. This cannot be undone.'
            : 'This will permanently delete this journey and related records. This cannot be undone.'
        }
        confirmLabel="Delete journey"
        isDestructive
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default JourneysPage;
