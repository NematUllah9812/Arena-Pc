# Vortex Labs — Hardware Syndicate Storefront

Custom PC foundry + parts store for **Vortex Labs Hardware Syndicate LLC** (Austin, TX), built to the
*Vortex Labs PC Shop Architecture* spec.

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind 4 + "Kinetic HUD" design system · Supabase
(Postgres, Realtime, Storage) · Vercel.

## What's inside

| Area | Highlights |
| --- | --- |
| **Storefront** | Catalog with facets, full-text search and a ⌘K palette, product pages with spec tables, flash deals, Syndicate packages, cart and checkout. |
| **Compatibility Engine v2** (`src/lib/engine/compatibility-engine-v2.ts`) | Three verdicts: `VERIFIED_FIT`, `TIGHT_TOLERANCE` and `HARD_CONFLICT`. It checks socket, memory generation, BIOS-flashback (auto-injects the $15 flash for DIY), GPU and radiator clearance, air cooler vs RAM height, PSU transient headroom, and auto-injects an Instapak foam brace for GPUs over 1200 g. Pure code, so it runs on both client and server. |
| **Margin-aware Auto-Forge** | Searches the catalog for the best build in a budget. It scores on performance, bottleneck ratio and blended margin, and favours overstock and leftover items. Server-only; margin data never leaves the server. |
| **Inventory** | `reserve_inventory_atomic` uses `FOR UPDATE SKIP LOCKED` to give a 10-minute price-locked lease, plus a price-floor trigger (60% of cost) and atomic order placement. |
| **Build-Bay Telemetry** | Seven-stage public tracker (`/telemetry/VL-ORD-88412`) with live updates over Supabase Realtime (20 s poll fallback), a printable blueprint and a BIOS-profile download. Customer PII is masked. |
| **Stealth `/admin` vault** | Without a knock cookie, every `/admin*` URL returns a 404 that is byte-identical to a real one. Login is codename + TOTP, then a WebAuthn passkey (user verification required). Roles, dual-admin price overrides (30-min, consumed by a different operator), and an append-only audit ledger. |
| **Foundry console** | Technicians advance orders through the stages, log serials, thermals and OCCT results, and upload proofs (magic-byte checked). |

## Local development

```bash
npm install
cp .env.example .env.local   # leave the Supabase vars empty to use the in-memory demo repository
npm run dev                  # http://localhost:3000
npm test                     # vitest: engine, pricing, auto-forge, TOTP/HMAC
npm run typecheck
```

Without the Supabase variables the app runs on an in-memory repository seeded with the same 78 products,
packages, deals and demo orders, so it is fully explorable offline.

## Database

The migrations in `supabase/migrations/` hold the full schema: enums, products with `search_vector`,
flash deals, reservations, the facets materialized view, orders, telemetry, the vault and the audit
ledger, plus the `SECURITY DEFINER` RPCs. Row-level security is on for every table. The anon role can
only call `catalog_search`; everything else goes through the server with the service role.
`npm run db:seed-sql` regenerates the seed.

## Admin access (first run)

1. Open `https://<host>/admin?knock=<ADMIN_STEALTH_KNOCK_SECRET>`. This sets a 12-hour cloak cookie
   (scoped to `/admin`, HttpOnly, SameSite=Strict) and redirects to the gate.
2. **Enroll Operator** with a codename and `ADMIN_BOOTSTRAP_TOKEN`. This works only while the vault is
   empty and creates the first `OVERSEER`.
3. Scan the TOTP secret into an authenticator, confirm a code, then register a passkey.
4. Later operators are invited from **Vault** with a single-use 24-hour link bound to a codename and role.

Set `WEBAUTHN_RP_ID` to your production domain before enrolling. Passkeys are tied to the domain they
were created on.

## Deployment (Vercel)

`vercel.json` pins functions to `hnd1`, next to the Supabase region (ap-northeast-1), and schedules the
daily `/api/cron/sweep`. See `.env.example` for every variable. Never expose `SUPABASE_SERVICE_ROLE_KEY`
with a `NEXT_PUBLIC_` prefix.

> Payments: checkout places the order and reserves stock; payment capture is out of scope (a payment
> link is issued by email).
