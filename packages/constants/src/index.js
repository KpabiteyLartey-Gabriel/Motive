// GH Motive — Shared Constants

// ── User Roles ──────────────────────────────────────────────
export const USER_ROLES = {
  DRIVER: 'DRIVER',
  OWNER: 'OWNER',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_MEMBER: 'COMPANY_MEMBER',
  FLEET_MANAGER: 'FLEET_MANAGER',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
  LEGAL_PROFESSIONAL: 'LEGAL_PROFESSIONAL',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

// ── Vehicle Status ───────────────────────────────────────────
export const VEHICLE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  AVAILABLE: 'AVAILABLE',
  PENDING_ASSIGNMENT: 'PENDING_ASSIGNMENT',
  ASSIGNED: 'ASSIGNED',
  ACTIVE: 'ACTIVE',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  SUSPENDED: 'SUSPENDED',
  IN_DISPUTE: 'IN_DISPUTE',
  COMPLETED_WORK_AND_PAY: 'COMPLETED_WORK_AND_PAY',
  OWNERSHIP_TRANSFER_PENDING: 'OWNERSHIP_TRANSFER_PENDING',
  TRANSFERRED: 'TRANSFERRED',
  ARCHIVED: 'ARCHIVED',
};

// ── Operating Models ─────────────────────────────────────────
export const OPERATING_MODELS = {
  WORK_AND_PAY: 'WORK_AND_PAY',
  RENTAL: 'RENTAL',
  DRIVING_ON: 'DRIVING_ON',
};

// ── Contract Types ───────────────────────────────────────────
export const CONTRACT_TYPES = {
  WORK_AND_PAY: 'WORK_AND_PAY',
  RENTAL: 'RENTAL',
  DRIVING_ON: 'DRIVING_ON',
  FLEET_MANAGEMENT: 'FLEET_MANAGEMENT',
  VEHICLE_PLACEMENT: 'VEHICLE_PLACEMENT',
  MAINTENANCE_SERVICE: 'MAINTENANCE_SERVICE',
  LEGAL_SERVICE: 'LEGAL_SERVICE',
};

// ── Contract Status ──────────────────────────────────────────
export const CONTRACT_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_SIGNATURES: 'PENDING_SIGNATURES',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  EXPIRED: 'EXPIRED',
  COMPLETED: 'COMPLETED',
  IN_DISPUTE: 'IN_DISPUTE',
};

// ── Payment Status ───────────────────────────────────────────
export const PAYMENT_STATUS = {
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
  SETTLED: 'SETTLED',
};

// ── Currency ─────────────────────────────────────────────────
export const CURRENCY = {
  GHS: 'GHS',
};
export const DEFAULT_CURRENCY = 'GHS';

// ── Pagination ───────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// ── Company Types ────────────────────────────────────────────
export const COMPANY_TYPES = {
  TRANSPORT: 'TRANSPORT',
  FLEET_MANAGEMENT: 'FLEET_MANAGEMENT',
  VEHICLE_PLACEMENT: 'VEHICLE_PLACEMENT',
  MAINTENANCE: 'MAINTENANCE',
  LEGAL_DISPUTE_RESOLUTION: 'LEGAL_DISPUTE_RESOLUTION',
};

// ── Status Labels (for display) ──────────────────────────────
export const STATUS_LABELS = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Pending Verification',
  SUSPENDED: 'Suspended',
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  UNDER_MAINTENANCE: 'Under Maintenance',
  IN_DISPUTE: 'In Dispute',
  COMPLETED_WORK_AND_PAY: 'Work & Pay Complete',
  OWNERSHIP_TRANSFER_PENDING: 'Transfer Pending',
  TRANSFERRED: 'Transferred',
};

// ── Status Colors ────────────────────────────────────────────
export const STATUS_COLORS = {
  ACTIVE: 'success',
  AVAILABLE: 'success',
  PENDING_VERIFICATION: 'warning',
  PENDING_ASSIGNMENT: 'warning',
  SUSPENDED: 'danger',
  IN_DISPUTE: 'danger',
  UNDER_MAINTENANCE: 'warning',
  TRANSFERRED: 'neutral',
  ARCHIVED: 'neutral',
};
