'use client';
export function LogoutButton() {
  return (
    <button
      type="button"
      className="btn-ghost size-sm tone-tungsten"
      onClick={async () => {
        await fetch('/admin/api/vault/logout', { method: 'POST' });
        window.location.href = '/';
      }}
    >
      Seal Vault
    </button>
  );
}
