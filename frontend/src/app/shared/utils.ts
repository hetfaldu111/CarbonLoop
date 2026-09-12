import { HttpErrorResponse } from '@angular/common/http';

export function errMsg(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
    if (typeof body === 'string' && body.length < 300) return body;
    if (err.status === 0) return 'Cannot reach the API server. Is the backend running on port 8080?';
    if (err.status === 403) return 'You are not allowed to do that.';
    if (err.status === 404) return 'Not found.';
    return `${fallback} (HTTP ${err.status})`;
  }
  return fallback;
}

export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toDateTimeInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${toDateInput(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function addDays(d: Date, days: number): Date { const r = new Date(d); r.setDate(r.getDate() + days); return r; }

/** Converts a datetime-local / date input value to an ISO instant string. */
export function toIso(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toISOString();
}
