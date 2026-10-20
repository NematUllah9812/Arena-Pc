'use client';
import { useState, type FormEvent } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { HudCard } from '@/components/hud/HudCard';
import { adminFetch } from './adminFetch';

type Mode = 'login' | 'enroll';

export function GateClient({ bootstrapAvailable, invite, inviteCodename }: { bootstrapAvailable: boolean; invite?: string; inviteCodename?: string }) {
  const [mode, setMode] = useState<Mode>(invite || bootstrapAvailable ? 'enroll' : 'login');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ secret: string; uri: string; role: string; options: unknown } | null>(null);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const start = await adminFetch<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('/admin/api/vault/login-start', {
        method: 'POST',
        json: { codename: String(f.get('codename') ?? ''), totp: String(f.get('totp') ?? '') }
      });
      if (!start.ok) throw new Error(start.detail ?? start.error);
      const assertion = await startAuthentication({ optionsJSON: start.options });
      const fin = await adminFetch('/admin/api/vault/login-finish', { method: 'POST', json: { response: assertion } });
      if (!fin.ok) throw new Error(fin.detail ?? fin.error);
      window.location.href = '/admin';
    } catch (e) {
      setErr(e instanceof Error ? (e.name === 'NotAllowedError' ? 'Passkey ceremony cancelled or timed out.' : e.message) : 'Vault denied.');
    } finally {
      setBusy(false);
    }
  };

  const beginEnroll = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = { codename: String(f.get('codename') ?? '') };
      if (invite) body.invite = invite;
      else body.bootstrap = String(f.get('bootstrap') ?? '');
      const res = await adminFetch<{ role: string; options: unknown; totp: { secret: string; uri: string } }>('/admin/api/vault/enroll-start', { method: 'POST', json: body });
      if (!res.ok) throw new Error(res.detail ?? res.error);
      setEnroll({ secret: res.totp.secret, uri: res.totp.uri, role: res.role, options: res.options });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Enrollment denied.');
    } finally {
      setBusy(false);
    }
  };

  const finishEnroll = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!enroll) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const attestation = await startRegistration({ optionsJSON: enroll.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      const fin = await adminFetch('/admin/api/vault/enroll-finish', { method: 'POST', json: { totp: String(f.get('totp') ?? ''), response: attestation } });
      if (!fin.ok) throw new Error(fin.detail ?? fin.error);
      window.location.href = '/admin';
    } catch (e) {
      setErr(e instanceof Error ? (e.name === 'NotAllowedError' ? 'Passkey ceremony cancelled or timed out.' : e.message) : 'Enrollment failed.');
      setEnroll(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HudCard tone="tungsten" innerClassName="p-6">
      <div className="mb-6 grid grid-cols-2 gap-px border border-hairline bg-hairline">
        {(['login', 'enroll'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setErr(null);
              setEnroll(null);
            }}
            className={`py-2.5 font-mono text-[0.65rem] tracking-[0.16em] uppercase ${mode === m ? 'bg-tungsten/15 text-tungsten' : 'bg-chassis text-muted hover:text-primary'}`}
          >
            {m === 'login' ? 'Authenticate' : 'Enroll Operator'}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={login} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="hud-label">Codename</span>
            <input name="codename" className="hud-input uppercase" required autoComplete="username webauthn" maxLength={32} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="hud-label">Authenticator code</span>
            <input name="totp" className="hud-input tabular tracking-[0.4em]" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
          </label>
          <button type="submit" className="btn-overclock tone-tungsten" disabled={busy}>
            {busy ? 'Awaiting passkey…' : 'Unlock with Passkey'}
          </button>
        </form>
      ) : !enroll ? (
        <form onSubmit={beginEnroll} className="flex flex-col gap-4">
          <p className="text-xs text-secondary">
            {invite ? 'Invite detected. Choose the codename the Overseer issued it for.' : bootstrapAvailable ? 'The vault is empty. Enroll the first Overseer with the bootstrap token.' : 'Enrollment requires an Overseer-issued invite link.'}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="hud-label">Codename</span>
            <input name="codename" className="hud-input uppercase" required defaultValue={inviteCodename ?? ''} pattern="[A-Za-z][A-Za-z0-9_\-]{2,31}" maxLength={32} />
          </label>
          {!invite ? (
            <label className="flex flex-col gap-1.5">
              <span className="hud-label">Bootstrap token</span>
              <input name="bootstrap" type="password" className="hud-input" required disabled={!bootstrapAvailable} autoComplete="off" />
            </label>
          ) : null}
          <button type="submit" className="btn-overclock tone-tungsten" disabled={busy || (!invite && !bootstrapAvailable)}>
            {busy ? 'Verifying…' : 'Begin Enrollment'}
          </button>
        </form>
      ) : (
        <form onSubmit={finishEnroll} className="flex flex-col gap-4">
          <p className="text-xs text-secondary">
            Role granted: <span className="font-mono text-tungsten">{enroll.role}</span>. Add this secret to your authenticator app, then enter the current code and register a hardware passkey.
          </p>
          <div className="border border-hairline bg-void p-3">
            <p className="hud-label mb-1">TOTP secret (shown once)</p>
            <p className="font-mono text-sm break-all text-volt select-all">{enroll.secret}</p>
            <a href={enroll.uri} className="mt-2 inline-block font-mono text-[0.65rem] text-cryo hover:underline">
              Open in authenticator (otpauth://)
            </a>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="hud-label">Current authenticator code</span>
            <input name="totp" className="hud-input tabular tracking-[0.4em]" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
          </label>
          <button type="submit" className="btn-overclock tone-tungsten" disabled={busy}>
            {busy ? 'Awaiting passkey…' : 'Register Passkey & Enter'}
          </button>
        </form>
      )}
      {err ? (
        <p role="alert" className="mt-4 border-l-2 border-conflict bg-conflict/5 px-3 py-2 font-mono text-xs text-conflict">
          {err}
        </p>
      ) : null}
    </HudCard>
  );
}
