import { getPublicTelemetry } from '@/lib/services/telemetry';
import { COMPANY } from '@/lib/config/company';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const v = await getPublicTelemetry(decodeURIComponent(orderNumber));
  if (!v) return new Response('Not found', { status: 404 });
  const bios = v.logs.filter((l) => l.stage === 'BIOS_FLASH_AND_EXPO_TUNING').at(-1);
  const burn = v.logs.filter((l) => l.stage === 'OCCT_THERMAL_BURN_IN_4HR').at(-1);
  const board = v.manifest.lines.find((l) => l.category === 'MOTHERBOARD');
  const cpu = v.manifest.lines.find((l) => l.category === 'CPU');
  const ram = v.manifest.lines.find((l) => l.category === 'RAM');
  const m = bios?.telemetry_metrics;
  const body = [
    `; ${COMPANY.fullBrand} — BIOS PROFILE`,
    `; Order ${v.order_number}  ·  generated ${formatDateTime(new Date().toISOString())}`,
    ';',
    `[System]`,
    `Motherboard        = ${board?.name ?? 'n/a'}`,
    `Processor          = ${cpu?.name ?? 'n/a'}`,
    `Memory             = ${ram ? `${ram.quantity}x ${ram.name}` : 'n/a'}`,
    '',
    `[Firmware]`,
    `BIOS Revision      = ${m?.bios_version_flashed ?? (bios ? 'factory' : 'pending')}`,
    `Flashed By         = ${bios?.technician_code ?? 'pending'}`,
    `Flashed At         = ${bios ? formatDateTime(bios.logged_at) : 'pending'}`,
    '',
    `[Memory]`,
    `Profile            = ${m?.expo_xmp_profile_verified ?? 'pending'}`,
    `Memory Context Restore = Enabled`,
    `Power Down Mode    = Disabled`,
    '',
    `[Boot]`,
    `Secure Boot        = Enabled (Standard)`,
    `TPM / fTPM         = Enabled`,
    `Resizable BAR      = Enabled`,
    `Above 4G Decoding  = Enabled`,
    `CSM                = Disabled`,
    '',
    `[Burn-In Validation]`,
    `OCCT Peak CPU      = ${burn?.telemetry_metrics.peak_occt_cpu_temp_c ?? 'n/a'} C`,
    `FurMark Peak GPU   = ${burn?.telemetry_metrics.peak_furmark_gpu_temp_c ?? 'n/a'} C`,
    `3DMark Time Spy    = ${burn?.telemetry_metrics.time_spy_score ?? 'n/a'}`,
    '',
    `; Support: ${COMPANY.contacts.support.email}  ${COMPANY.contacts.support.phone}`,
    ''
  ].join('\r\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="${v.order_number}-bios-profile.txt"`,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex'
    }
  });
}
