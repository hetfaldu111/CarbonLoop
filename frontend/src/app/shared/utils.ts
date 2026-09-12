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

export type FieldErrors = Record<string, string>;

/** Empty string, whitespace, null and undefined all count as "not filled in". */
export function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/**
 * Collects one validation message per field so a form can highlight the offending input and list
 * every problem at once.
 *
 * Validation runs on demand when the user submits. These are deliberately plain methods over plain
 * values: the forms bind with ngModel to ordinary properties rather than signals, so a computed()
 * would never re-run when the user types.
 */
export class Check {
  readonly errors: FieldErrors = {};

  /** First message wins, so the most specific rule should be applied first. */
  private fail(key: string, message: string): void {
    if (!this.errors[key]) this.errors[key] = message;
  }

  required(key: string, value: unknown, label: string): this {
    if (isBlank(value)) this.fail(key, `${label} is required.`);
    return this;
  }

  minLength(key: string, value: unknown, min: number, label: string): this {
    const s = String(value ?? '').trim();
    if (!s) this.fail(key, `${label} is required.`);
    else if (s.length < min) this.fail(key, `${label} must be at least ${min} characters.`);
    return this;
  }

  email(key: string, value: unknown, label = 'Email'): this {
    const s = String(value ?? '').trim();
    if (!s) this.fail(key, `${label} is required.`);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) this.fail(key, 'Enter a valid email address, for example name@company.com.');
    return this;
  }

  /**
   * A required number with optional bounds. `gt` is exclusive; `min` and `max` are inclusive.
   * A number input yields null when cleared, which is treated as missing rather than as zero.
   */
  num(key: string, value: unknown, label: string, o: { gt?: number; min?: number; max?: number; unit?: string } = {}): this {
    if (isBlank(value)) { this.fail(key, `${label} is required.`); return this; }
    const n = Number(value);
    const u = o.unit ? o.unit : '';
    if (!Number.isFinite(n)) { this.fail(key, `${label} must be a number.`); return this; }
    if (o.gt !== undefined && n <= o.gt) this.fail(key, `${label} must be greater than ${o.gt}${u}.`);
    else if (o.min !== undefined && o.max !== undefined && (n < o.min || n > o.max)) this.fail(key, `${label} must be between ${o.min}${u} and ${o.max}${u}.`);
    else if (o.min !== undefined && n < o.min) this.fail(key, `${label} must be at least ${o.min}${u}.`);
    else if (o.max !== undefined && n > o.max) this.fail(key, `${label} must be at most ${o.max}${u}.`);
    return this;
  }

  /** Records `message` against `key` when `bad` is true. For rules that need their own wording. */
  when(bad: boolean, key: string, message: string): this {
    if (bad) this.fail(key, message);
    return this;
  }

  /** True when the second instant is not strictly after the first. Blank values are left to required(). */
  static notAfter(start: unknown, end: unknown): boolean {
    if (isBlank(start) || isBlank(end)) return false;
    const a = new Date(String(start)).getTime();
    const b = new Date(String(end)).getTime();
    return Number.isFinite(a) && Number.isFinite(b) && b <= a;
  }

  /** True when the value is a valid instant at or before now. */
  static inPast(v: unknown): boolean {
    if (isBlank(v)) return false;
    const t = new Date(String(v)).getTime();
    return Number.isFinite(t) && t <= Date.now();
  }

  get ok(): boolean { return Object.keys(this.errors).length === 0; }
  get list(): string[] { return Object.values(this.errors); }
}

/**
 * Brings the first field flagged invalid into view and focuses it. Without this, pressing submit
 * on a long form can look like nothing happened when the only errors are below the fold.
 * Deferred a tick so Angular has rendered the invalid classes first.
 */
export function scrollToFirstInvalid(root: ParentNode = document): void {
  setTimeout(() => {
    const holder = root.querySelector<HTMLElement>('.field.invalid, .lf.invalid');
    const target = holder ?? root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = target.matches('input, select, textarea')
      ? target
      : target.querySelector<HTMLElement>('input, select, textarea');
    control?.focus({ preventScroll: true });
  });
}
