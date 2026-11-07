import React, { useState, useEffect, useRef } from 'react';
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
import FileUploadSection, { type FileRecord } from "../../components/data/FileUploadSection";
import { STORAGE_BUCKETS } from "../../services/storageService";
import { auditService, type AuditLogEntry } from "../../services/auditService";

// Helper type for user preview
type UserPreview = {
  id: string;
  name: string;
  email: string;
  role: string;
  location?: string;
};

export type JourneyDetailTab = 'overview' | 'medical' | 'legal' | 'trust' | 'milestones' | 'delivery';

// Helper to determine the default active tab based on current journey stage
export const getActiveTabForJourney = (
  journey: Journey | null,
  hasFinancialAccess = true
): JourneyDetailTab => {
  if (!journey) return 'overview';
  if (journey.status === 'Completed') return 'overview';

  switch (journey.stage) {
    case 'Medical Screening':
      return 'medical';
    case 'Legal':
      return 'legal';
    case 'Embryo Transfer':
      return 'milestones';
    case 'Pregnancy':
      return 'milestones';
    case 'Birth':
    case 'Postpartum':
      return 'delivery';
    default:
      return 'overview';
  }
};

// Helper to check if a tab is unlocked for a given journey stage (back tabs allowed, future tabs locked)
export const isTabUnlocked = (
  tabId: JourneyDetailTab,
  stage?: string,
  status?: string
): boolean => {
  // Completed journeys have all stage history unlocked
  if (status === 'Completed') return true;

  // Overview is always accessible as the root summary
  if (tabId === 'overview') return true;

  const stageOrder: JourneyStage[] = [
    'Medical Screening',
    'Legal',
    'Embryo Transfer',
    'Pregnancy',
    'Birth',
    'Postpartum',
  ];

  const currentStageIndex = stage ? stageOrder.indexOf(stage as JourneyStage) : 0;

  // Define minimum stage index required to unlock each tab:
  // Medical Screening = 0 -> medical (min 0)
  // Legal = 1 -> legal (min 1), trust (min 1)
  // Embryo Transfer = 2 -> milestones (min 2)
  // Pregnancy = 3 -> milestones (min 2)
  // Birth = 4 -> delivery (min 4)
  // Postpartum = 5 -> delivery (min 4)
  const tabMinStageIndex: Record<JourneyDetailTab, number> = {
    overview: 0,
    medical: 0,
    legal: 1,
    trust: 1,
    milestones: 2,
    delivery: 4,
  };

  const requiredIndex = tabMinStageIndex[tabId] ?? 0;
  return currentStageIndex >= requiredIndex;
};

// Helper to get lock reason / tooltip for disabled future tabs
export const getTabLockReason = (tabId: JourneyDetailTab): string => {
  switch (tabId) {
    case 'legal':
      return 'Locked: Unlocks in Legal stage';
    case 'trust':
      return 'Locked: Unlocks in Legal & Trust stage';
    case 'milestones':
      return 'Locked: Unlocks in Embryo Transfer & Pregnancy stage';
    case 'delivery':
      return 'Locked: Unlocks in Birth & Delivery stage';
    default:
      return 'Locked for future stages';
  }
};

export interface JourneyHistoryItem {
  id: string;
  stage: string;
  action: string;
  timestamp: string;
  description?: string;
  type: 'stage_progression' | 'checklist' | 'milestone' | 'delivery' | 'status_change' | 'system';
  actorEmail?: string;
}

export const buildUnifiedJourneyHistory = (
  journey: Journey | null,
  auditLogs: AuditLogEntry[]
): JourneyHistoryItem[] => {
  if (!journey) return [];

  const items: JourneyHistoryItem[] = [];
  const seenKeys = new Set<string>();

  const pushItem = (item: JourneyHistoryItem) => {
    if (!item.action || !item.timestamp) return;
    const dateKey = (item.timestamp || '').slice(0, 10);
    const dedupeKey = `${item.stage}_${item.action.toLowerCase()}_${dateKey}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      items.push(item);
    }
  };

  // 1. Explicit stageHistory stored in journeyNotes
  const notes = (journey.journeyNotes as any) || {};
  if (Array.isArray(notes.stageHistory)) {
    notes.stageHistory.forEach((h: any) => {
      if (h && h.action && h.timestamp) {
        pushItem({
          id: h.id || `hist_${Math.random().toString(36).slice(2, 6)}`,
          stage: h.stage || 'General',
          action: h.action,
          timestamp: h.timestamp,
          description: h.description || h.details,
          type: h.type || 'checklist',
          actorEmail: h.actorEmail,
        });
      }
    });
  }

  // 2. Audit logs from Supabase audit_log table
  (auditLogs || []).forEach((log) => {
    let stage = (log.afterData?.stage as string) || (log.beforeData?.stage as string) || 'General';
    let type: JourneyHistoryItem['type'] = 'system';
    const action = log.action;

    if (action.includes('stage changed') || action.includes('Progressed')) {
      type = 'stage_progression';
      if (log.afterData?.stage) stage = log.afterData.stage as string;
    } else if (action.includes('checklist')) {
      type = 'checklist';
      if (log.afterData?.stage) stage = log.afterData.stage as string;
    } else if (action.includes('Milestone') || action.includes('milestone')) {
      type = 'milestone';
    } else if (action.includes('deliver') || action.includes('Delivery') || action.includes('Birth')) {
      type = 'delivery';
      stage = 'Birth';
    } else if (action.includes('Completed') || action.includes('Escrow')) {
      type = 'status_change';
      stage = 'Postpartum';
    } else if (action.includes('Journey created')) {
      type = 'system';
      stage = 'Medical Screening';
    }

    pushItem({
      id: `audit_${log.id}`,
      stage,
      action,
      timestamp: log.createdAt,
      type,
      actorEmail: log.actorEmail,
      description: log.afterData?.details
        ? String(log.afterData.details)
        : log.afterData?.value
        ? `Value: ${log.afterData.value}`
        : undefined,
    });
  });

  // 3. Completed checklist items recorded in journeyNotes.stageChecklists
  JOURNEY_STAGES.forEach((stageName) => {
    const checklistState = getStageChecklistState(journey, stageName);
    const definitions = STAGE_CHECKLISTS[stageName] || [];
    definitions.forEach((def) => {
      const val = checklistState[def.id];
      if (val !== undefined && val !== false && val !== '') {
        let timestamp = journey.createdAt;
        let desc = 'Step completed';

        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
          timestamp = `${val}T12:00:00.000Z`;
          desc = `Recorded date: ${formatMMDDYYYY(val)}`;
        } else if (def.options || def.isNumber) {
          desc = `Recorded: ${val}${def.unit ? ' ' + def.unit : ''}`;
        }

        pushItem({
          id: `chk_${stageName}_${def.id}`,
          stage: stageName,
          action: `${def.label}`,
          timestamp,
          description: desc,
          type: 'checklist',
        });
      }
    });
  });

  // 4. Milestones array in journeyNotes.milestones
  if (Array.isArray(notes.milestones)) {
    notes.milestones.forEach((m: any) => {
      if (m && m.title) {
        pushItem({
          id: `mile_${m.id || Math.random().toString(36).slice(2, 6)}`,
          stage: m.type === 'legal' ? 'Legal' : m.type === 'transfer' ? 'Embryo Transfer' : 'Medical Screening',
          action: `Milestone: ${m.title}`,
          timestamp: m.completedDate || m.date || m.createdAt || journey.createdAt,
          description: m.notes ? `${m.status || 'Scheduled'} • ${m.notes}` : (m.status || 'Scheduled'),
          type: 'milestone',
        });
      }
    });
  }

  // 5. EDD (Estimated Delivery Date)
  if (journey.estimatedDeliveryDate) {
    pushItem({
      id: `edd_${journey.id}`,
      stage: 'Pregnancy',
      action: 'Estimated Delivery Date (EDD) Set',
      timestamp: `${journey.estimatedDeliveryDate}T12:00:00.000Z`,
      description: `Target delivery date: ${formatMMDDYYYY(journey.estimatedDeliveryDate)}`,
      type: 'milestone',
    });
  }

  // 6. Delivery Date
  if (journey.deliveryDate) {
    pushItem({
      id: `deliv_${journey.id}`,
      stage: 'Birth',
      action: 'Baby Delivered',
      timestamp: `${journey.deliveryDate}T12:00:00.000Z`,
      description: `Delivery recorded on ${formatMMDDYYYY(journey.deliveryDate)}`,
      type: 'delivery',
    });
  }

  // 7. Journey Completed
  if (journey.completedAt) {
    pushItem({
      id: `comp_${journey.id}`,
      stage: 'Postpartum',
      action: 'Journey Completed',
      timestamp: journey.completedAt,
      description: 'Journey marked as fully completed. Escrow and final postpartum checks concluded.',
      type: 'status_change',
    });
  }

  // 8. Journey Created (root starting event)
  if (journey.createdAt) {
    pushItem({
      id: `created_${journey.id}`,
      stage: 'Medical Screening',
      action: 'Journey Started & Match Activated',
      timestamp: journey.createdAt,
      description: `Case #${journey.caseNumber} initiated. Started in Medical Screening stage.`,
      type: 'system',
    });
  }

  return items;
};

export const getHistoryTypeIcon = (type: JourneyHistoryItem['type']) => {
  switch (type) {
    case 'stage_progression':
      return {
        icon: 'ri-arrow-right-circle-line',
        bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
    case 'checklist':
      return {
        icon: 'ri-checkbox-circle-line',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'milestone':
      return {
        icon: 'ri-flag-line',
        bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'delivery':
      return {
        icon: 'ri-heart-pulse-line',
        bg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
    case 'status_change':
      return {
        icon: 'ri-shield-check-line',
        bg: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      };
    case 'system':
    default:
      return {
        icon: 'ri-rocket-line',
        bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
  }
};

export const getStageBadgeColor = (stage: string): 'blue' | 'yellow' | 'teal' | 'green' | 'orange' | 'purple' => {
  switch (stage) {
    case 'Medical Screening': return 'blue';
    case 'Legal': return 'purple';
    case 'Embryo Transfer': return 'teal';
    case 'Pregnancy': return 'green';
    case 'Birth': return 'orange';
    case 'Postpartum': return 'yellow';
    default: return 'blue';
  }
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
  const [detailTab, setDetailTab] = useState<JourneyDetailTab>('overview');
  const selectedJourneyIdRef = useRef<string | null>(null);

  // Step History state
  const [journeyAuditLogs, setJourneyAuditLogs] = useState<AuditLogEntry[]>([]);
  const [historyFilterStage, setHistoryFilterStage] = useState<string>('All');
  const [historySortAsc, setHistorySortAsc] = useState<boolean>(false);

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
  const [deliveryBabyGender, setDeliveryBabyGender] = useState('');
  const [deliveryBabyWeight, setDeliveryBabyWeight] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');
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

  const fetchJourneyAuditLogs = async (journeyId: string) => {
    try {
      const logs = await auditService.getByEntity('journey', journeyId);
      setJourneyAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Failed to load journey audit logs', err);
      setJourneyAuditLogs([]);
    }
  };

  useEffect(() => {
    if (selectedJourney) {
      const isNewJourney = selectedJourneyIdRef.current !== selectedJourney.id;
      selectedJourneyIdRef.current = selectedJourney.id;

      if (isNewJourney) {
        setDetailSurrogate(null);
        setDetailParent(null);
        setDetailTab('overview');
        fetchUserPreview(selectedJourney.gestationalCarrierId, 'Surrogate');
        fetchUserPreview(selectedJourney.intendedParentId, 'Intended Parent');
        fetchJourneyAuditLogs(selectedJourney.id);
      } else {
        if (detailTab !== 'overview') {
          setDetailTab('overview');
        }
      }

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

      const birthChecklist = getStageChecklistState(selectedJourney, 'Birth');
      setDeliveryBabyGender(typeof birthChecklist.birth_baby_gender === 'string' ? birthChecklist.birth_baby_gender : '');
      setDeliveryBabyWeight(typeof birthChecklist.birth_baby_weight === 'string' ? birthChecklist.birth_baby_weight : '');
      setDeliveryMode(typeof birthChecklist.birth_delivery_mode === 'string' ? birthChecklist.birth_delivery_mode : '');

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
      }

      // Record in stageHistory
      const prevHistory = Array.isArray(notes.stageHistory) ? (notes.stageHistory as any[]) : [];
      notes.stageHistory = [
        {
          id: `stage_${Date.now()}`,
          stage: nextStage,
          action: `Stage Progressed: ${selectedJourney.stage} → ${nextStage}`,
          description: trimmed ? `Notes: ${trimmed}` : `Advanced to ${nextStage}. Stage checklist was completed.`,
          timestamp: new Date().toISOString(),
          type: 'stage_progression',
          actorEmail: user?.email || 'Admin',
        },
        ...prevHistory,
      ];

      await journeyService.updateJourneyNotes(selectedJourney.id, notes);
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

  // ─── Stage checklist update ────────────────────────────────────────────────
  const handleUpdateStageChecklistItem = async (itemId: string, value: boolean | string) => {
    if (!selectedJourney) return;
    const stage = selectedJourney.stage as JourneyStage;
    const current = getStageChecklistState(selectedJourney, stage);
    const updated = { ...current, [itemId]: value };

    // Optimistic update
    const prevNotes = (selectedJourney.journeyNotes as any) || {};
    const prevHistory = Array.isArray(prevNotes.stageHistory) ? (prevNotes.stageHistory as any[]) : [];

    const checklistItems = STAGE_CHECKLISTS[stage] || [];
    const itemDef = checklistItems.find(i => i.id === itemId);
    const itemLabel = itemDef ? itemDef.label : itemId;

    let updatedHistory = [...prevHistory];
    if (value) {
      const dateStr = typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)
        ? formatMMDDYYYY(value)
        : typeof value === 'string' ? value : '';
      
      const desc = dateStr ? `Recorded date: ${dateStr}` : `Marked as completed`;

      updatedHistory = [
        {
          id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          stage,
          action: `Completed: ${itemLabel}`,
          description: desc,
          timestamp: new Date().toISOString(),
          type: 'checklist',
          actorEmail: user?.email || 'Admin',
        },
        ...prevHistory,
      ];
    }

    const newNotes = {
      ...prevNotes,
      stageChecklists: { ...(prevNotes.stageChecklists || {}), [stage]: updated },
      stageHistory: updatedHistory,
    };
    const newSelected = { ...selectedJourney, journeyNotes: newNotes } as typeof selectedJourney;
    setSelectedJourney(newSelected);
    setJourneys(prev => prev.map(j => j.id === selectedJourney.id ? newSelected : j));

    try {
      await journeyService.updateJourneyNotes(selectedJourney.id, newNotes);
      if (value) {
        void auditService.log(
          `Journey checklist [${stage}]: ${itemLabel}`,
          'journey',
          selectedJourney.id,
          { after: { stage, item: itemId, value } }
        );
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update checklist', type: 'error' });
      // Revert optimistic update
      setSelectedJourney(selectedJourney);
    }
  };

  const getStageColorClasses = (stage: string, isChecked: boolean) => {
    if (!isChecked) return 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:border-gray-300';
    switch (stage) {
      case 'Medical Screening': return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400';
      case 'Legal': return 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-400';
      case 'Embryo Transfer': return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400';
      case 'Pregnancy': return 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400';
      case 'Birth': return 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400';
      case 'Postpartum': return 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400';
      default: return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400';
    }
  };

  const getStageIconColor = (stage: string) => {
    switch (stage) {
      case 'Medical Screening': return 'text-blue-500';
      case 'Legal': return 'text-purple-500';
      case 'Embryo Transfer': return 'text-rose-500';
      case 'Pregnancy': return 'text-indigo-500';
      case 'Birth': return 'text-teal-500';
      case 'Postpartum': return 'text-orange-500';
      default: return 'text-rose-500';
    }
  };

  // ─── Record Delivery ──────────────────────────────────────────────────────
  const handleRecordDelivery = async () => {
    if (!selectedJourney || !deliveryDateInput) return;

    try {
      const currentBirthChecklist = getStageChecklistState(selectedJourney, 'Birth');
      const updatedBirthChecklist: Record<string, boolean | string> = {
        ...currentBirthChecklist,
        birth_delivery_date: deliveryDateInput,
        ...(deliveryBabyGender ? { birth_baby_gender: deliveryBabyGender } : {}),
        ...(deliveryBabyWeight ? { birth_baby_weight: deliveryBabyWeight } : {}),
        ...(deliveryMode ? { birth_delivery_mode: deliveryMode } : {}),
      };

      const prevNotes = (selectedJourney.journeyNotes as any) || {};
      const prevHistory = Array.isArray(prevNotes.stageHistory) ? (prevNotes.stageHistory as any[]) : [];
      const updatedHistory = [
        {
          id: `deliv_${Date.now()}`,
          stage: 'Birth',
          action: 'Baby Delivered',
          description: `Delivery recorded on ${formatMMDDYYYY(deliveryDateInput)}${deliveryBabyGender ? ` • Gender: ${deliveryBabyGender}` : ''}${deliveryBabyWeight ? ` • Weight: ${deliveryBabyWeight} lbs` : ''}${deliveryMode ? ` • Mode: ${deliveryMode}` : ''}`,
          timestamp: new Date().toISOString(),
          type: 'delivery',
          actorEmail: user?.email || 'Admin',
        },
        ...prevHistory,
      ];

      const newNotes = {
        ...prevNotes,
        stageChecklists: { ...(prevNotes.stageChecklists || {}), Birth: updatedBirthChecklist },
        stageHistory: updatedHistory,
      };

      await journeyService.updateJourneyNotes(selectedJourney.id, newNotes);
      await journeyService.updateDeliveryDate(selectedJourney.id, deliveryDateInput);
      await journeyService.updateStageChecklist(selectedJourney.id, 'Birth', updatedBirthChecklist);
      await fetchJourneys();
      setShowDeliveryModal(false);
      setDeliveryDateInput('');
      setToast({ message: 'Delivery date and details recorded!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to record delivery', type: 'error' });
    }
  };

  // ─── Journey Status Actions ────────────────────────────────────────────────
  const handleCompleteJourney = async () => {
    if (!selectedJourney) return;
    try {
      const prevNotes = (selectedJourney.journeyNotes as any) || {};
      const prevHistory = Array.isArray(prevNotes.stageHistory) ? (prevNotes.stageHistory as any[]) : [];
      const updatedHistory = [
        {
          id: `comp_${Date.now()}`,
          stage: 'Postpartum',
          action: 'Journey Completed',
          description: 'All stages, postpartum checkups, and escrow completed.',
          timestamp: new Date().toISOString(),
          type: 'status_change',
          actorEmail: user?.email || 'Admin',
        },
        ...prevHistory,
      ];
      await journeyService.updateJourneyNotes(selectedJourney.id, {
        ...prevNotes,
        stageHistory: updatedHistory,
      });

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

      const prevNotes = (selectedJourney.journeyNotes as any) || {};
      const prevHistory = Array.isArray(prevNotes.stageHistory) ? (prevNotes.stageHistory as any[]) : [];
      const updatedHistory = [
        {
          id: `mile_${Date.now()}`,
          stage: newMilestoneType === 'legal' ? 'Legal' : newMilestoneType === 'transfer' ? 'Embryo Transfer' : 'Medical Screening',
          action: `Milestone Added: ${newMilestoneTitle}`,
          description: `Scheduled for ${formatMMDDYYYY(newMilestoneDate)} (${newMilestoneType})`,
          timestamp: new Date().toISOString(),
          type: 'milestone',
          actorEmail: user?.email || 'Admin',
        },
        ...prevHistory,
      ];
      await journeyService.updateJourneyNotes(selectedJourney.id, {
        ...prevNotes,
        stageHistory: updatedHistory,
      });

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

      // Update Birth stage checklist details (Gender, Weight, Mode of Delivery)
      const currentBirthChecklist = getStageChecklistState(selectedJourney, 'Birth');
      const updatedBirthChecklist: Record<string, boolean | string> = {
        ...currentBirthChecklist,
        ...(deliveryBabyGender ? { birth_baby_gender: deliveryBabyGender } : {}),
        ...(deliveryBabyWeight ? { birth_baby_weight: deliveryBabyWeight } : {}),
        ...(deliveryMode ? { birth_delivery_mode: deliveryMode } : {}),
      };
      await journeyService.updateStageChecklist(selectedJourney.id, 'Birth', updatedBirthChecklist);

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

  const formatDateTime = (timestampStr?: string) => {
    if (!timestampStr) return 'N/A';
    try {
      const d = new Date(timestampStr);
      if (isNaN(d.getTime())) return timestampStr;
      if (timestampStr.length === 10 && timestampStr.includes('-')) {
        return formatMMDDYYYY(timestampStr);
      }
      const datePart = formatMMDDYYYY(d);
      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${datePart} at ${timePart}`;
    } catch {
      return timestampStr;
    }
  };

  const getRelativeTime = (timestampStr?: string) => {
    if (!timestampStr) return '';
    try {
      const d = new Date(timestampStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      if (isNaN(diffMs) || diffMs < 0) return '';
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths}mo ago`;
      return `${Math.floor(diffMonths / 12)}y ago`;
    } catch {
      return '';
    }
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
                      onClick={() => {
                        selectedJourneyIdRef.current = null;
                        setSelectedJourney(null);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <i className="ri-close-line text-xl text-gray-600 dark:text-gray-400"></i>
                    </button>
                  </div>

                  {/* Tab Navigation with Back-Tab Access & Future Tab Disabling */}
                  {(() => {
                    const currentActiveTab = getActiveTabForJourney(selectedJourney, canViewFinancials(profile?.role as string));
                    const rawTabs: Array<{ id: JourneyDetailTab; label: string; icon: string; restricted?: boolean }> = [
                      { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line', restricted: false },
                      // Temporarily hidden per request - only Overview is visible for now:
                      // { id: 'medical', label: 'Medical', icon: 'ri-heart-pulse-line', restricted: false },
                      // { id: 'legal', label: 'Legal', icon: 'ri-file-text-line', restricted: false },
                      // ...(canViewFinancials(profile?.role as string) ? [{ id: 'trust' as const, label: 'Trust & Funds', icon: 'ri-safe-line', restricted: true }] : []),
                      // { id: 'milestones', label: 'Milestones', icon: 'ri-flag-line', restricted: false },
                      // { id: 'delivery', label: 'Delivery', icon: 'ri-heart-3-line', restricted: false },
                    ];

                    const tabsWithState = rawTabs.map(tab => {
                      const unlocked = isTabUnlocked(tab.id, selectedJourney.stage, selectedJourney.status);
                      const isLocked = !unlocked;
                      const isCurrent = tab.id === currentActiveTab;
                      const lockReason = getTabLockReason(tab.id);

                      return {
                        ...tab,
                        disabled: isLocked,
                        isCurrent,
                        lockReason
                      };
                    });

                    return (
                      <div className="flex border-b border-rose-100/60 dark:border-white/5 mb-6 overflow-x-auto scrollbar-thin">
                        {tabsWithState.map(tab => {
                          const isSelected = detailTab === tab.id;
                          const isLocked = tab.disabled;
                          const isCurrent = tab.isCurrent;

                          return (
                            <button
                              key={tab.id}
                              type="button"
                              disabled={isLocked}
                              onClick={() => {
                                if (!isLocked) {
                                  setDetailTab(tab.id);
                                }
                              }}
                              title={isLocked ? tab.lockReason : (isCurrent ? 'Current active stage tab' : undefined)}
                              className={`relative px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                isLocked
                                  ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-45 select-none'
                                  : isSelected
                                  ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-bold'
                                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:border-gray-200 dark:hover:border-white/10'
                              }`}
                            >
                              <i className={`${tab.icon} ${isSelected ? 'text-rose-500' : isLocked ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'}`}></i>
                              <span>{tab.label}</span>

                              {/* Lock Icon for future disabled tabs */}
                              {isLocked && (
                                <span className="ml-0.5 inline-flex items-center text-xs text-gray-400 dark:text-gray-600" title={tab.lockReason}>
                                  <i className="ri-lock-2-line text-xs"></i>
                                </span>
                              )}

                              {/* Indicator dot for current active stage tab */}
                              {isCurrent && !isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5" title="Current Active Stage"></span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Current Active Stage Notice when browsing non-overview tabs */}
                  {selectedJourney.status === 'Active' && detailTab !== 'overview' && (
                    <div className="mb-6 flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-white/5 border border-rose-100/60 dark:border-white/5 text-xs">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        <span>
                          Current Journey Stage: <strong className="text-gray-900 dark:text-white font-bold">{selectedJourney.stage}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailTab('overview')}
                        className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <span>View Stage Checklist on Overview</span>
                        <i className="ri-arrow-right-s-line"></i>
                      </button>
                    </div>
                  )}

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
                              <i className={`ri-list-check-2 ${getStageIconColor(selectedJourney.stage)}`}></i>
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
                              const value = getStageChecklistState(selectedJourney, selectedJourney.stage as JourneyStage)[item.id];
                              const isChecked = !!value;
                              
                              // Dropdown / number items: completed once a value is chosen or entered.
                              if (item.options || item.isNumber) {
                                return (
                                  <div
                                    key={item.id}
                                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${getStageColorClasses(selectedJourney.stage, isChecked)}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isChecked ? 'bg-current border-current text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                        {isChecked && <i className="ri-check-line text-xs"></i>}
                                      </span>
                                      <span className="text-sm font-medium">{item.label}</span>
                                    </div>
                                    {item.options ? (
                                      <select
                                        aria-label={item.label}
                                        value={typeof value === 'string' ? value : ''}
                                        onChange={(e) => handleUpdateStageChecklistItem(item.id, e.target.value || false)}
                                        className="px-2 py-1 text-sm rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white"
                                      >
                                        <option value="">Select…</option>
                                        {item.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          inputMode="decimal"
                                          aria-label={item.label}
                                          key={`${selectedJourney.id}-${item.id}`}
                                          defaultValue={typeof value === 'string' ? value : ''}
                                          onBlur={(e) => {
                                            const raw = e.target.value.trim();
                                            const next = raw !== '' && Number(raw) > 0 ? raw : false;
                                            if (next !== (value || false)) handleUpdateStageChecklistItem(item.id, next);
                                          }}
                                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                          className="w-24 px-2 py-1 text-sm rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white"
                                        />
                                        {item.unit && <span className="text-xs text-gray-500 dark:text-gray-400">{item.unit}</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (item.isDate) {
                                return (
                                  <div 
                                    key={item.id} 
                                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${getStageColorClasses(selectedJourney.stage, isChecked)} cursor-pointer`}
                                    onClick={() => {
                                      const newValue = isChecked ? false : new Date().toISOString().split('T')[0];
                                      handleUpdateStageChecklistItem(item.id, newValue);
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isChecked ? 'bg-current border-current text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                        {isChecked && <i className="ri-check-line text-xs"></i>}
                                      </span>
                                      <span className="text-sm font-medium">{item.label}</span>
                                    </div>
                                    <input
                                      type="date"
                                      value={typeof value === 'string' ? value : ''}
                                      onChange={(e) => handleUpdateStageChecklistItem(item.id, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 text-sm rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white"
                                    />
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={item.id}
                                  onClick={() => handleUpdateStageChecklistItem(item.id, !value)}
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${getStageColorClasses(selectedJourney.stage, isChecked)}`}
                                >
                                  <span className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isChecked ? 'bg-current border-current text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                    {isChecked && <i className="ri-check-line text-xs"></i>}
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

                      {/* ── STEP & STAGE HISTORY TIMELINE ──────────────────────── */}
                      {(() => {
                        const timelineItems = buildUnifiedJourneyHistory(selectedJourney, journeyAuditLogs);
                        const sortedTimeline = [...timelineItems].sort((a, b) => {
                          const timeA = new Date(a.timestamp).getTime() || 0;
                          const timeB = new Date(b.timestamp).getTime() || 0;
                          return historySortAsc ? timeA - timeB : timeB - timeA;
                        });
                        const filteredTimeline = sortedTimeline.filter((item) => {
                          if (historyFilterStage === 'All') return true;
                          return item.stage === historyFilterStage;
                        });

                        return (
                          <div className="p-5 md:p-6 rounded-2xl border border-rose-100/70 dark:border-white/10 bg-white dark:bg-[#15111f] shadow-sm space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-100/60 dark:border-white/5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                                  <i className="ri-history-line text-xl"></i>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                      Journey Step History
                                    </h4>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold">
                                      {filteredTimeline.length} {filteredTimeline.length === 1 ? 'Step' : 'Steps'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Detailed record of what happened at each step with timestamps
                                  </p>
                                </div>
                              </div>

                              {/* Controls: Filter by stage & Sort */}
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <select
                                  value={historyFilterStage}
                                  onChange={(e) => setHistoryFilterStage(e.target.value)}
                                  aria-label="Filter history by stage"
                                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-200 font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                                >
                                  <option value="All">All Stages ({timelineItems.length})</option>
                                  {JOURNEY_STAGES.map((s) => {
                                    const count = timelineItems.filter((item) => item.stage === s).length;
                                    return (
                                      <option key={s} value={s}>
                                        {s} ({count})
                                      </option>
                                    );
                                  })}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => setHistorySortAsc(!historySortAsc)}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 font-medium"
                                  title={historySortAsc ? 'Switch to Newest First' : 'Switch to Oldest First'}
                                >
                                  <i className={`ri-sort-${historySortAsc ? 'asc' : 'desc'} text-rose-500`}></i>
                                  <span>{historySortAsc ? 'Oldest first' : 'Newest first'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Timeline List */}
                            {filteredTimeline.length === 0 ? (
                              <div className="text-center py-8 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                <i className="ri-time-line text-3xl text-gray-400 mb-1"></i>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  No history events found for this filter
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Steps and updates will appear here as they are completed.
                                </p>
                              </div>
                            ) : (
                              <div className="relative pl-6 space-y-4 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-rose-100 dark:before:bg-white/10">
                                {filteredTimeline.map((item) => {
                                  const typeStyle = getHistoryTypeIcon(item.type);
                                  const stageColor = getStageBadgeColor(item.stage);

                                  return (
                                    <div key={item.id} className="relative group">
                                      {/* Timeline node */}
                                      <div
                                        className={`absolute -left-6 top-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white dark:border-[#15111f] shadow-sm text-sm transition-transform group-hover:scale-110 ${typeStyle.bg}`}
                                      >
                                        <i className={typeStyle.icon}></i>
                                      </div>

                                      {/* Event Content Box */}
                                      <div className="bg-gray-50/70 dark:bg-white/5 hover:bg-rose-50/40 dark:hover:bg-white/8 rounded-xl p-3.5 border border-gray-100 dark:border-white/5 transition-all">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Badge color={stageColor as any}>{item.stage}</Badge>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                              {item.action}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <i className="ri-time-line text-rose-500"></i>
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                              {formatDateTime(item.timestamp)}
                                            </span>
                                            {getRelativeTime(item.timestamp) && (
                                              <span className="px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-white/10 text-[10px] text-gray-600 dark:text-gray-300 font-medium">
                                                {getRelativeTime(item.timestamp)}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {item.description && (
                                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 pl-0.5 leading-relaxed">
                                            {item.description}
                                          </p>
                                        )}

                                        {item.actorEmail && (
                                          <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                                            <span className="flex items-center gap-1">
                                              <i className="ri-user-line text-gray-400"></i>
                                              Updated by: <strong className="text-gray-600 dark:text-gray-300 font-medium">{item.actorEmail}</strong>
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender of the baby</label>
                          <select
                            value={deliveryBabyGender}
                            onChange={e => setDeliveryBabyGender(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          >
                            <option value="">Select gender...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight of the baby (lbs)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 7.5"
                            value={deliveryBabyWeight}
                            onChange={e => setDeliveryBabyWeight(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mode of Delivery</label>
                          <select
                            value={deliveryMode}
                            onChange={e => setDeliveryMode(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          >
                            <option value="">Select mode...</option>
                            <option value="Vaginal">Vaginal</option>
                            <option value="Cesarean">Cesarean</option>
                          </select>
                        </div>
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
                          <Button
                            color="green"
                            className="w-full"
                            onClick={() => {
                              setDeliveryDateInput(selectedJourney.deliveryDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
                              const birthChecklist = getStageChecklistState(selectedJourney, 'Birth');
                              setDeliveryBabyGender(typeof birthChecklist.birth_baby_gender === 'string' ? birthChecklist.birth_baby_gender : '');
                              setDeliveryBabyWeight(typeof birthChecklist.birth_baby_weight === 'string' ? birthChecklist.birth_baby_weight : '');
                              setDeliveryMode(typeof birthChecklist.birth_delivery_mode === 'string' ? birthChecklist.birth_delivery_mode : '');
                              setShowDeliveryModal(true);
                            }}
                          >
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Gender of the baby
                      </label>
                      <select
                        value={deliveryBabyGender}
                        onChange={(e) => setDeliveryBabyGender(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="">Select gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Weight of the baby (lbs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 7.5"
                        value={deliveryBabyWeight}
                        onChange={(e) => setDeliveryBabyWeight(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mode of Delivery
                      </label>
                      <select
                        value={deliveryMode}
                        onChange={(e) => setDeliveryMode(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="">Select mode...</option>
                        <option value="Vaginal">Vaginal</option>
                        <option value="Cesarean">Cesarean</option>
                      </select>
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
