'use client';
export function PrintButton() {
  return (
    <button type="button" className="btn-overclock size-sm" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
