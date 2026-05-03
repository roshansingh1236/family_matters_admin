export type UserRole = 'surrogate' | 'parent' | 'agency' | 'admin';

export type UserStatus = 
  | 'Inquiry'
  | 'Consultation Pending'
  | 'Consultation Scheduled'
  | 'Consultation Complete'
  | 'Profile Pending'
  | 'Profile Complete'
  | 'Match Pending'
  | 'Matched'
  | 'New Application'
  | 'Documents Pending'
  | 'Interview Scheduled'
  | 'Medical Records Requested'
  | 'Medical Records Received'
  | 'Medical Records Reviewed'
  | 'Medical Screening Scheduled'
  | 'Medically Cleared for Program'
  | 'Background Check Pending'
  | 'Background Check Complete'
  | 'Psychological Evaluation Scheduled'
  | 'Psychological Evaluation Complete'
  | 'Home Study Pending'
  | 'Home Study Complete'
  | 'Accepted to Program'
  | 'Ready to Match'
  | 'On Hold'
  | 'Declined / Inactive';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: UserStatus | string;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  profileImageUrl?: string;
  data?: any;
  form_data?: any;
  profile_completed?: boolean;
  form_2_completed?: boolean;
  profileCompleted?: boolean;
}

export type MatchStatus = 
  | 'Proposed' 
  | 'Presented' 
  | 'Accepted' 
  | 'Active' 
  | 'Delivered' 
  | 'Escrow Closure' 
  | 'Completed' 
  | 'Cancelled';

export interface Match {
  id: string;
  intendedParentId: string;
  gestationalCarrierId: string;
  status: MatchStatus;
  journeyId?: string;
  agencyNotes?: string;
  createdAt: string;
  updatedAt: string;
  intendedParentData?: User;
  gestationalCarrierData?: User;
  data?: Record<string, any>;
}

export const IP_STATUSES: UserStatus[] = [
  'Inquiry',
  'Consultation Pending',
  'Consultation Scheduled',
  'Consultation Complete',
  'Profile Pending',
  'Profile Complete',
  'Match Pending',
  'Matched',
  'On Hold',
  'Declined / Inactive'
];

export const GC_STATUSES: UserStatus[] = [
  'New Application',
  'Reviewed',
  'Contacted',
  'Follow up',
  'Documents Pending',
  'Interview Scheduled',
  'Medical Records Requested',
  'Medical Records Received',
  'Medical Records Reviewed',
  'Medical Screening Scheduled',
  'Medically Cleared for Program',
  'Background Check Pending',
  'Background Check Complete',
  'Psychological Evaluation Scheduled',
  'Psychological Evaluation Complete',
  'Home Study Pending',
  'Home Study Complete',
  'Accepted to Program',
  'Ready to Match',
  'On Hold',
  'Declined / Inactive'
];

export const GC_MEDICAL_SCREENING_STATUSES: UserStatus[] = [
  'Not Started',
  'Medical Records Requested',
  'Medical Records Received',
  'Medical Records Reviewed',
  'Medical Screening Scheduled',
  'Medically Cleared for Program',
  'Declined for Program'
];

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  status: 'Active' | 'Discontinued';
}

export interface Payment {
  id: string;
  type: string;
  amount: number;
  status: 'Pending' | 'Completed' | 'Failed';
  date: string;
}

export type MedicalRecordRequestStatus = 
  | 'Not Requested' 
  | 'Requested' 
  | 'Follow-Up Needed' 
  | 'Received (Partial)' 
  | 'Received (Complete)' 
  | 'Unable to Obtain';

export type HipaaAuthStatus = 'Not Sent' | 'Sent' | 'Signed' | 'Expired';

export interface ReceivedFile {
  id: string;
  name: string;
  url: string;
  fileType: string;
  uploadedBy: string;
  receivedDate: string;
  pageCount?: number;
}

export interface MedicalRecordRequest {
  id: string;
  providerName: string;
  facilityName?: string;
  recordType: string;
  pregnancyNumber?: number;
  dateRequested?: string;
  requestMethod?: string;
  followUpDate?: string;
  status: MedicalRecordRequestStatus;
  authorizationOnFile: boolean;
  hipaaAuthStatus?: HipaaAuthStatus;
  hipaaAuthSignedAt?: string;
  reviewSummary?: string;
  clearanceRecommendation?: 'Cleared' | 'Not Cleared' | 'Conditional / Needs Follow-Up';
  blockingIssues?: boolean;
  receivedFiles?: ReceivedFile[];
  notes?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  adminId: string;
  action: string;
  details: string;
  createdAt: string;
}
