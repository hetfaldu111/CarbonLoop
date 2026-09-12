import { Pipe, PipeTransform } from '@angular/core';

/** Indian-grouped rupee formatting: 420000 -> ₹4,20,000 */
export function formatInr(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const neg = value < 0;
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);
  const [intPart, frac] = fixed.split('.');
  let grouped: string;
  if (intPart.length <= 3) grouped = intPart;
  else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${neg ? '-' : ''}₹${grouped}${frac ? '.' + frac : ''}`;
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string { return formatInr(value, decimals); }
}

@Pipe({ name: 'tonnes' })
export class TonnesPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 1): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const n = Number(value);
    const s = Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
    return `${s} t`;
  }
}

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    // Split camelCase ("trustTier" -> "trust Tier") before normalising SNAKE_CASE.
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  }
}

@Pipe({ name: 'shortId' })
export class ShortIdPipe implements PipeTransform {
  transform(value: string | null | undefined, len = 8): string { return value ? value.slice(0, len) : '—'; }
}
