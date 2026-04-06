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
  | 'Proposed'        // Internal pairing under consideration
  | 'Presented'       // Match shown to GC and IP(s)
  | 'Accepted'        // Both parties agree to proceed
  | 'Active'          // Journey created and operational
  | 'Delivered'       // Delivery has occurred
  | 'Escrow Closure'  // Post-delivery financial reconciliation
  | 'Completed'       // Escrow closed; match archived
  | 'Cancelled';      // Terminated early (reason required)

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
  internalNotes?: string;
  parentAccepted?: boolean;
  surrogateAccepted?: boolean;
  parentDeclined?: boolean;
  surrogateDeclined?: boolean;
  // Lifecycle tracking
  deliveryDate?: string; // ISO Date
  escrowClosedAt?: string; // ISO Date
  cancellationReason?: string;
  coordinatorId?: string;
  journeyId?: string;
  // Denormalized
  intendedParentData?: User;
  gestationalCarrierData?: User;
}

// Journey top-level status (per spec)
export type JourneyStatus = 
  | 'Active'
  | 'Completed'
  | 'Cancelled';

// Journey operational sub-stage (within Active status)
export type JourneyStage = 
  | 'Medical Screening'
  | 'Legal'
  | 'Embryo Transfer'
  | 'Pregnancy'
  | 'Birth'
  | 'Postpartum';

export interface Journey {
  id: string;
  matchId: string;
  caseNumber: string;
  intendedParentId: string;
  gestationalCarrierId: string;
  caseManagerId: string;
  status: JourneyStatus | string;
  stage: JourneyStage | string; // Operational sub-stage within Active
  createdAt: string; // ISO Date
  completedAt?: string; // ISO Date
  estimatedDeliveryDate?: string; // ISO Date
  deliveryDate?: string; // ISO Date - actual delivery
  postpartumNotes?: Record<string, unknown>;
  
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
  intendedParentId?: string; // For agency fee schedules linked directly to IP
  caseNumber?: string; // Denormalized for display
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  date: string; // ISO Date
  description: string;
  status: 'Pending' | 'Completed' | 'Cancelled' | 'Waived';
  paymentMethod?: string;
  reference?: string; // Used for installment tagging: "installment:1", "installment:2"
  waiverReason?: string; // Required if status = 'Waived' (admin only)
  createdBy: string;
  createdAt: string;
}

// Per spec: Agency fees must be tracked per IP with installment structure, separate from escrow
export interface AgencyFeeInstallment {
  id: string;
  intendedParentId: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'Pending' | 'Paid' | 'Waived' | 'Overdue';
  waiverReason?: string; // Admin only, required if Waived
  notes?: string;
  createdAt: string;
}

// Per spec: Medical record requests are tracked per GC, per provider/OB history entry
export type MedicalRecordRequestStatus =
  | 'Not Requested'
  | 'Requested'
  | 'Follow-Up Needed'
  | 'Received (Partial)'
  | 'Received (Complete)'
  | 'Unable to Obtain';

export type MedicalRecordRequestMethod = 'Fax' | 'Portal' | 'Email' | 'Mail';

export interface MedicalRecordRequest {
  id: string;
  gcId: string; // Links to GC user
  // Link to OB history entry (matches pregnancyN fields from intake form)
  pregnancyNumber?: number;
  providerName: string;
  facilityName: string;
  recordType: string; // OB delivery records, prenatal records, operative report, lab results, imaging, clearance letter, mental health, other
  dateRequested?: string;
  requestMethod?: MedicalRecordRequestMethod;
  authorizationOnFile: boolean;
  followUpDate?: string;
  status: MedicalRecordRequestStatus;
  notes?: string;
  // Review outcome
  reviewSummary?: string;
  clearanceRecommendation?: 'Cleared' | 'Not Cleared' | 'Conditional / Needs Follow-Up';
  blockingIssues?: boolean;
  // Received file attachments (linked to this request)
  receivedFiles?: ReceivedFile[];
  // HIPAA Medical Authorization tracking
  hipaaAuthStatus?: HipaaAuthStatus;
  hipaaAuthSentAt?: string;
  hipaaAuthSignedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type MedicalScreeningStatus =
  | 'Not Started'
  | 'Records Requested'
  | 'Records Partially Received'
  | 'Under Medical Review'
  | 'Medically Cleared for Program'
  | 'Medically Not Cleared'
  | 'On Hold – Needs Follow-Up';

export const GC_MEDICAL_SCREENING_STATUSES: MedicalScreeningStatus[] = [
  'Not Started',
  'Records Requested',
  'Records Partially Received',
  'Under Medical Review',
  'Medically Cleared for Program',
  'Medically Not Cleared',
  'On Hold – Needs Follow-Up',
];

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

// Per spec: Agency Reimbursables — tracked per Journey, separate from agency fees
export type ReimbursableCategory =
  | 'Travel – Air'
  | 'Travel – Ground'
  | 'Lodging'
  | 'Meals'
  | 'Medical – Copay'
  | 'Medical – Prescription'
  | 'Lost Wages'
  | 'Childcare'
  | 'Other';

export type ReimbursableStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Partially Approved'
  | 'Reimbursed'
  | 'Denied';

export interface AgencyReimbursable {
  id: string;
  journeyId: string;
  gcId?: string;
  category: ReimbursableCategory;
  amount: number;
  approvedAmount?: number;
  receiptUrl?: string;
  description: string;
  incurredDate: string;
  submittedDate: string;
  status: ReimbursableStatus;
  reviewNotes?: string;
  reimbursedDate?: string;
  createdBy: string;
  createdAt: string;
}

// Per spec: 11-stage agency pipeline
export type AgencyPipelineStage =
  | 'Inquiry Received'
  | 'Consultation Completed'
  | 'Program Accepted'
  | 'Agency Fee Installment 1 Paid'
  | 'Matching in Progress'
  | 'Match Accepted'
  | 'Agency Fee Installment 2 Paid'
  | 'Journey Active'
  | 'Delivered'
  | 'Escrow Closure'
  | 'Case Completed';

// Per spec: files received must link to the originating record request
export interface ReceivedFile {
  id: string;
  name: string;
  url: string;
  fileType: string;
  pageCount?: number;
  source?: string;
  uploadedBy: string;
  receivedDate: string;
}

export type HipaaAuthStatus = 'Not Sent' | 'Sent' | 'Signed' | 'Expired';

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
