'use client';
import { LogoutIcon } from '@/components/ui/Icons';

export function LogoutButton() {
  return (
    <button
      type="button"
      title="Sign out"
      aria-label="Sign out"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-chassis hover:text-conflict"
      onClick={async () => {
        await fetch('/admin/api/vault/logout', { method: 'POST' });
        window.location.href = '/';
      }}
    >
      <LogoutIcon size={18} />
    </button>
  );
}
