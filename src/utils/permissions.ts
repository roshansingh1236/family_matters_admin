/**
 * Role-Based Access Control (RBAC) Utility
 * 
 * Per spec: Admin sees everything, Finance sees revenue + reimbursables,
 * Case Managers see operational data only (no financials).
 * If user lacks permission → data does not appear at all.
 */

export type AdminRole = 'Admin' | 'Finance' | 'Case Manager' | 'Agency Staff';

export type Permission =
  | 'view_financials'        // Agency fees, revenue dashboards
  | 'view_reimbursables'     // Reimbursement tracking
  | 'view_fee_amounts'       // Actual dollar amounts for fees
  | 'view_installments'      // Installment schedules
  | 'view_revenue_dashboard' // Revenue dashboards
  | 'manage_matches'         // Create/update matches
  | 'manage_journeys'        // Update journey stages
  | 'manage_users'           // Edit user profiles/statuses
  | 'override_guardrails'    // Admin override of status guardrails
  | 'view_medical_records'   // Full medical record access
  | 'view_audit_log'         // Audit trail
  | 'manage_settings'        // Application settings & preferences
  | 'manage_access_codes';   // Unlock access codes for protected sections

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  'Admin': [
    'view_financials',
    'view_reimbursables',
    'view_fee_amounts',
    'view_installments',
    'view_revenue_dashboard',
    'manage_matches',
    'manage_journeys',
    'manage_users',
    'override_guardrails',
    'view_medical_records',
    'view_audit_log',
    'manage_settings',
    'manage_access_codes',
  ],
  'Finance': [
    'view_financials',
    'view_reimbursables',
    'view_fee_amounts',
    'view_installments',
    'view_revenue_dashboard',
    'view_audit_log',
  ],
  'Case Manager': [
    'manage_matches',
    'manage_journeys',
    'manage_users',
    'view_medical_records',
    // NO financials, NO fee amounts, NO revenue dashboard, NO settings
  ],
  'Agency Staff': [
    'manage_matches',
    'manage_journeys',
    'manage_users',
    'view_medical_records',
  ],
};

/**
 * Normalize raw role strings (case-insensitive, trims) to a recognized AdminRole
 */
export function normalizeAdminRole(role: string | undefined): AdminRole | null {
  if (!role) return null;
  const trimmed = role.trim();
  if (trimmed in ROLE_PERMISSIONS) {
    return trimmed as AdminRole;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'admin' || lower === 'administrator') {
    return 'Admin';
  }
  if (lower === 'finance' || lower === 'billing') {
    return 'Finance';
  }
  if (
    lower === 'case manager' ||
    lower === 'case_manager' ||
    lower === 'casemanager' ||
    lower === 'coordinator' ||
    lower === 'program coordinator'
  ) {
    return 'Case Manager';
  }
  if (
    lower === 'agency staff' ||
    lower === 'agency_staff' ||
    lower === 'agencystaff' ||
    lower === 'staff' ||
    lower === 'agency' ||
    lower === 'medical' ||
    lower === 'legal'
  ) {
    return 'Agency Staff';
  }
  return null;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const adminRole = normalizeAdminRole(role);
  if (!adminRole) return false;
  const permissions = ROLE_PERMISSIONS[adminRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: string | undefined): Permission[] {
  if (!role) return [];
  const adminRole = normalizeAdminRole(role);
  if (!adminRole) return [];
  return ROLE_PERMISSIONS[adminRole] || [];
}

/**
 * Check if the user has the Admin role
 */
export function isAdmin(role: string | undefined): boolean {
  return normalizeAdminRole(role) === 'Admin';
}

/**
 * Check if the current user can see financial data
 */
export function canViewFinancials(role: string | undefined): boolean {
  return hasPermission(role, 'view_financials');
}

/**
 * Check if the current user can see fee amounts (not just indicators)
 */
export function canViewFeeAmounts(role: string | undefined): boolean {
  return hasPermission(role, 'view_fee_amounts');
}

/**
 * Check if the current user can manage matches
 */
export function canManageMatches(role: string | undefined): boolean {
  return hasPermission(role, 'manage_matches');
}

/**
 * Check if the current user has admin override capability
 */
export function canOverrideGuardrails(role: string | undefined): boolean {
  return hasPermission(role, 'override_guardrails');
}

/**
 * Check if the current user can manage application settings
 */
export function canManageSettings(role: string | undefined): boolean {
  return hasPermission(role, 'manage_settings');
}

/**
 * Check if the current user can view or update access codes
 */
export function canManageAccessCodes(role: string | undefined): boolean {
  return hasPermission(role, 'manage_access_codes');
}
