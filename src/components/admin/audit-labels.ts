/** Human-readable names for audit log action codes. Unknown codes fall back to a tidied version of the code. */
const LABELS: Record<string, string> = {
  BUILD_BAY_STAGE_ADVANCE: 'Order moved to next stage',
  FLASH_DEAL_CREATE: 'Deal created',
  FLASH_DEAL_ACTIVATE: 'Deal turned on',
  FLASH_DEAL_DEACTIVATE: 'Deal turned off',
  INVENTORY_UPDATE: 'Stock updated',
  PRICE_UPDATE: 'Price changed',
  PRICE_UPDATE_DUAL_OVERRIDE: 'Price changed (with approval)',
  PRICE_FLOOR_BLOCKED: 'Price change blocked (below minimum)',
  PRICE_OVERRIDE_ISSUED: 'Price approval issued',
  PRODUCT_PHOTOS_UPDATE: 'Product photos updated',
  ADMIN_LOCK: 'Team member locked',
  ADMIN_UNLOCK: 'Team member unlocked',
  VAULT_INVITE_ISSUED: 'Invite created',
  VAULT_INVITE_ENROLL: 'Team member joined',
  VAULT_BOOTSTRAP_ENROLL: 'First admin set up',
  VAULT_LOGIN: 'Signed in',
  VAULT_LOGIN_FACTOR_REJECTED: 'Sign-in failed (wrong code)',
  VAULT_PASSKEY_REJECTED: 'Sign-in failed (passkey)'
};

export function auditLabel(code: string): string {
  if (LABELS[code]) return LABELS[code];
  const t = code.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
