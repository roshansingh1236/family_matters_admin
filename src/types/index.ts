export type UserRole = 'Intended Parent' | 'Surrogate' | 'Agency Staff' | 'Admin';

export type UserStatus = 
  // GC Specific
  | 'New Application'
  | 'Pre-Screen'
  | 'Screening in Progress'
  | 'Accepted to Program'
  // IP Specific
  | 'New Inquiry'
  | 'Consultation Complete'
  | 'Intake in Progress'
  // Shared
  | 'On Hold'
  | 'Declined / Inactive'
  // Legacy/Fallback (to be migrated)
  | 'Available'
  | 'Potential'
  | 'Records Review'
  | 'Screening'
  | 'Legal'
  | 'Cycling'
  | 'Pregnant'
  | 'To be Matched'
  | 'Matched'
  | 'Rematch';

export interface User {
  id: string;
  role?: UserRole | string;
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: UserStatus | string;
  formData?: Record<string, unknown>;
  form2?: Record<string, unknown>; // GC specific
  form2Data?: Record<string, unknown>; // IP/GC specific
  parent1?: Record<string, unknown>; // IP specific
  parent2?: Record<string, unknown>; // IP specific
  surrogateRelated?: Record<string, unknown>; // IP specific
  form2Completed?: boolean;
  profileCompleted?: boolean;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: unknown;
}

export const GC_STATUSES: UserStatus[] = [
  'New Application',
  'Pre-Screen',
  'Screening in Progress',
  'Accepted to Program',
  'On Hold',
  'Declined / Inactive'
];

export const IP_STATUSES: UserStatus[] = [
  'New Inquiry',
  'Consultation Complete',
  'Intake in Progress',
  'Accepted to Program',
  'On Hold',
  'Declined / Inactive'
];

// ... existing User imports ...

// ... (existing User types)

export type MatchStatus = 
  | 'Proposed'
  | 'Presented'
  | 'Accepted'
  | 'Active'
  | 'Delivered'
  | 'Escrow Closure'
  | 'Cancelled'
  | 'Completed';

export interface Match {
  id: string;
  intendedParentId: string;
  gestationalCarrierId?: string;
  createdAt: string; // ISO Date
  matchedAt?: string; // ISO Date
  status: MatchStatus | string;
  matchScore?: number;
  matchCriteria?: Record<string, unknown>;
  agencyNotes?: string;
  // Denormalized
  intendedParentData?: User;
  gestationalCarrierData?: User;
}

export type JourneyStatus = 
  | 'Medical Screening'
  | 'Legal'
  | 'Embryo Transfer'
  | 'Pregnancy'
  | 'Birth'
  | 'Completed'
  | 'Cancelled';

export interface Journey {
  id: string;
  matchId: string;
  caseNumber: string;
  intendedParentId: string;
  gestationalCarrierId: string;
  caseManagerId: string;
  status: JourneyStatus | string;
  createdAt: string; // ISO Date
  completedAt?: string; // ISO Date
  estimatedDeliveryDate?: string; // ISO Date
  
  milestones: CaseMilestone[];
  documents: CaseDocument[];
  payments: CasePayment[];
  medicalRecords?: Record<string, unknown>;
  legalAgreements?: Record<string, unknown>;
  journeyNotes?: Record<string, unknown>;
}

export interface CaseMilestone {
  id: string;
  title: string;
  description: string;
  type: string; // 'legal' | 'medical' | ...
  scheduledDate: string;
  completedDate?: string;
  status: 'pending' | 'inProgress' | 'completed' | 'cancelled' | 'overdue';
  notes?: string;
  assignedTo?: string[];
}

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  notes?: string;
  visibleToRoles?: string[];
}

export interface CasePayment {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled' | 'overdue';
  dueDate: string;
  paidDate?: string;
  notes?: string;
  transactionId?: string;
}

export type TransactionType = 'Revenue' | 'Expense';
export type TransactionCategory = 
  | 'Agency Fee' 
  | 'Legal Fee' 
  | 'Medical Fee' 
  | 'Screening Fee' 
  | 'Travel' 
  | 'Allowance' 
  | 'Other';

export interface AgencyTransaction {
  id: string;
  journeyId?: string; // Optional link to a specific journey
  caseNumber?: string; // Denormalized for display
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  date: string; // ISO Date
  description: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  paymentMethod?: string;
  reference?: string;
  createdBy: string;
  createdAt: string;
}

export type MedicalScreeningStatus = 'Pending' | 'In Review' | 'Cleared' | 'Rejected';

export interface MedicalScreening {
  id: string;
  surrogateId: string;
  surrogateName: string; // Denormalized
  status: MedicalScreeningStatus;
  submittedAt: string; // ISO Date
  reviewedAt?: string; // ISO Date
  reviewedBy?: string;
  
  // Medical History Form Data (Structured)
  medicalHistory: {
    pregnancies?: number;
    liveBirths?: number;
    csSections?: number;
    complications?: string;
    bmi?: number;
    bloodType?: string;
    // ... extensive medical fields
    conditions?: string[];
    medications?: string[];
  };

  // Uploaded Records
  documents: CaseDocument[];
  
  // Admin Notes
  internalNotes?: string;
  clearanceDate?: string;
}

export interface Payment {
  id?: string;
  surrogateId?: string;
  surrogateName?: string;
  parentId?: string;
  parentName?: string;
  childName?: string;
  amount: number;
  type: string;
  category: string;
  status: string;
  dueDate: string;
  paidDate?: string;
  description?: string;
  itemDescription?: string;
  notes?: string;
  referenceNumber?: string;
  createdAt?: string;
}
