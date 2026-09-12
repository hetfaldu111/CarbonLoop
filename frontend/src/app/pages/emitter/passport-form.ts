import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IMPURITIES, PassportDto } from '../../core/models';
import { Alert, FieldError } from '../../shared/widgets';
import { Check, FieldErrors, addDays, errMsg, isBlank, scrollToFirstInvalid, toDateInput, toDateTimeInput } from '../../shared/utils';

interface KV { key: string; value: string; }

const STEPS = [
  { n: 1, label: 'Source & capture', sub: 'Where the CO₂ comes from' },
  { n: 2, label: 'Availability & volume', sub: 'How much, and when' },
  { n: 3, label: 'Composition', sub: 'Claimed specification' },
  { n: 4, label: 'Location & documents', sub: 'Site and paperwork' },
];

const LAST_STEP = 4;

@Component({
  selector: 'app-passport-form',
  imports: [FormsModule, RouterLink, Alert, FieldError],
  template: `
    <div class="pf-shell">

      <!-- ===== step rail ===== -->
      <aside class="pf-rail" aria-label="Passport progress">
        <div class="pf-rail-head">
          <span class="pf-eyebrow">New stream</span>
          <h2>CO₂ Passport</h2>
        </div>
        <ol>
          @for (s of steps; track s.n) {
            <li [class.current]="step() === s.n" [class.done]="step() > s.n">
              <span class="rl-dot">@if (step() > s.n) {<span aria-hidden="true">✓</span>} @else {{{ s.n }}}</span>
              <span class="rl-text">
                <span class="rl-label">{{ s.label }}</span>
                <span class="rl-sub">{{ s.sub }}</span>
              </span>
            </li>
          }
        </ol>
        <p class="pf-rail-foot">Submitting queues an independent lab Certificate of Analysis. Self-reported specs are never trusted.</p>
      </aside>

      <!-- ===== the form ===== -->
      <main class="pf-main">
        <header class="pf-head">
          <h1>{{ stepTitle() }}</h1>
          <p>{{ stepBlurb() }}</p>
        </header>

        <app-alert [message]="error()" />

        <form class="form pf-card" (ngSubmit)="onSubmit()">

          <!-- ===== STEP 1 — source & capture ===== -->
          @if (step() === 1) {
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['source']">
                <label>Source <span class="required-star">*</span></label>
                <input name="source" [(ngModel)]="f.source" placeholder="e.g. Cement kiln flue gas" required [attr.aria-invalid]="fe()['source'] ? 'true' : null" />
                <app-field-error [msg]="fe()['source']" />
              </div>
              <div class="field"><label>Carbon origin</label><select name="carbonOrigin" [(ngModel)]="f.carbonOrigin"><option value="FOSSIL">Fossil</option><option value="PROCESS">Process emission</option><option value="BIOGENIC">Biogenic</option></select></div>
            </div>
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['captureTechnology']">
                <label>Capture technology <span class="required-star">*</span></label>
                <input name="captureTechnology" [(ngModel)]="f.captureTechnology" placeholder="e.g. Amine capture" required [attr.aria-invalid]="fe()['captureTechnology'] ? 'true' : null" />
                <app-field-error [msg]="fe()['captureTechnology']" />
              </div>
              <div class="field" [class.invalid]="fe()['meterId']">
                <label>Meter ID (signed readings) <span class="required-star">*</span></label>
                <input name="meterId" [(ngModel)]="f.meterId" placeholder="MTR-XXX-01" required [attr.aria-invalid]="fe()['meterId'] ? 'true' : null" />
                <app-field-error [msg]="fe()['meterId']" />
              </div>
            </div>
          }

          <!-- ===== STEP 2 — availability & volume ===== -->
          @if (step() === 2) {
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['dailyTonnage']">
                <label>Available (t/day) <span class="required-star">*</span></label>
                <input type="number" step="0.1" name="dailyTonnage" [(ngModel)]="f.dailyTonnage" required [attr.aria-invalid]="fe()['dailyTonnage'] ? 'true' : null" />
                <app-field-error [msg]="fe()['dailyTonnage']" />
              </div>
              <div class="field" [class.invalid]="fe()['dailyTonnageMin']">
                <label>Range min (t/day)</label>
                <input type="number" step="0.1" name="dailyTonnageMin" [(ngModel)]="f.dailyTonnageMin" [attr.aria-invalid]="fe()['dailyTonnageMin'] ? 'true' : null" />
                <app-field-error [msg]="fe()['dailyTonnageMin']" />
              </div>
              <div class="field" [class.invalid]="fe()['dailyTonnageMax']">
                <label>Range max (t/day)</label>
                <input type="number" step="0.1" name="dailyTonnageMax" [(ngModel)]="f.dailyTonnageMax" [attr.aria-invalid]="fe()['dailyTonnageMax'] ? 'true' : null" />
                <app-field-error [msg]="fe()['dailyTonnageMax']" />
              </div>
              <div class="field" [class.invalid]="fe()['totalVolumeTonnes']">
                <label>Total volume offered (t) <span class="required-star">*</span></label>
                <input type="number" step="1" name="totalVolumeTonnes" [(ngModel)]="f.totalVolumeTonnes" required [attr.aria-invalid]="fe()['totalVolumeTonnes'] ? 'true' : null" />
                <span class="hint">The pool that tender / auction / contract allocations lock against.</span>
                <app-field-error [msg]="fe()['totalVolumeTonnes']" />
              </div>
            </div>
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['availabilityStart']">
                <label>Availability window start <span class="required-star">*</span></label>
                <input type="date" name="availabilityStart" [(ngModel)]="f.availabilityStart" required [attr.aria-invalid]="fe()['availabilityStart'] ? 'true' : null" />
                <app-field-error [msg]="fe()['availabilityStart']" />
              </div>
              <div class="field" [class.invalid]="fe()['availabilityEnd']">
                <label>Availability window end <span class="required-star">*</span></label>
                <input type="date" name="availabilityEnd" [(ngModel)]="f.availabilityEnd" required [attr.aria-invalid]="fe()['availabilityEnd'] ? 'true' : null" />
                <app-field-error [msg]="fe()['availabilityEnd']" />
              </div>
              <div class="field" [class.invalid]="fe()['captureTimestamp']">
                <label>Capture timestamp <span class="required-star">*</span></label>
                <input type="datetime-local" name="captureTimestamp" [(ngModel)]="f.captureTimestamp" required [attr.aria-invalid]="fe()['captureTimestamp'] ? 'true' : null" />
                <app-field-error [msg]="fe()['captureTimestamp']" />
              </div>
            </div>
          }

          <!-- ===== STEP 3 — composition ===== -->
          @if (step() === 3) {
            <p class="pf-note">Everything on this step is your claim. An independent lab measures it before the passport can be listed.</p>
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['concentrationPct']">
                <label>CO₂ concentration (%) <span class="required-star">*</span></label>
                <input type="number" step="0.01" name="concentrationPct" [(ngModel)]="f.concentrationPct" required [attr.aria-invalid]="fe()['concentrationPct'] ? 'true' : null" />
                <app-field-error [msg]="fe()['concentrationPct']" />
              </div>
              <div class="field"><label>State</label><select name="physicalState" [(ngModel)]="f.physicalState"><option value="LIQUEFIED">Liquefied</option><option value="GASEOUS">Gaseous</option></select></div>
              <div class="field" [class.invalid]="fe()['pressureBar']">
                <label>Pressure (bar)</label>
                <input type="number" step="0.1" name="pressureBar" [(ngModel)]="f.pressureBar" [attr.aria-invalid]="fe()['pressureBar'] ? 'true' : null" />
                <app-field-error [msg]="fe()['pressureBar']" />
              </div>
              <div class="field"><label>Temperature (°C)</label><input type="number" step="0.1" name="temperatureC" [(ngModel)]="f.temperatureC" /></div>
            </div>
            <div class="pf-sub">Impurities (ppm)</div>
            <div class="form-row">
              @for (i of impurities; track i) {
                <div class="field" [class.invalid]="fe()['imp_' + i]">
                  <label>{{ i }}</label>
                  <input type="number" step="0.1" [name]="'imp_' + i" [(ngModel)]="imp[i]" [attr.aria-invalid]="fe()['imp_' + i] ? 'true' : null" />
                  <app-field-error [msg]="fe()['imp_' + i]" />
                </div>
              }
            </div>
          }

          <!-- ===== STEP 4 — location & documents ===== -->
          @if (step() === 4) {
            <div class="form-row">
              <div class="field" [class.invalid]="fe()['locationName']">
                <label>Location name <span class="required-star">*</span></label>
                <input name="locationName" [(ngModel)]="f.locationName" required [attr.aria-invalid]="fe()['locationName'] ? 'true' : null" />
                <app-field-error [msg]="fe()['locationName']" />
              </div>
              <div class="field" [class.invalid]="fe()['latitude']">
                <label>Latitude <span class="required-star">*</span></label>
                <input type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude" required [attr.aria-invalid]="fe()['latitude'] ? 'true' : null" />
                <app-field-error [msg]="fe()['latitude']" />
              </div>
              <div class="field" [class.invalid]="fe()['longitude']">
                <label>Longitude <span class="required-star">*</span></label>
                <input type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude" required [attr.aria-invalid]="fe()['longitude'] ? 'true' : null" />
                <app-field-error [msg]="fe()['longitude']" />
              </div>
              <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="pipelineConnected" [(ngModel)]="f.pipelineConnected" /> Pipeline-connected site</label></div>
            </div>

            <div class="pf-sub">Certifications (documents)</div>
            @if (fe()['certs']) {<app-field-error [msg]="fe()['certs']" />}
            @for (c of certs; track $index; let i = $index) {
              <div class="form-row">
                <div class="field"><input [name]="'cert_name_' + i" [(ngModel)]="c.name" placeholder="Document name (e.g. ISO 14064 audit)" /></div>
                <div class="field"><input [name]="'cert_url_' + i" [(ngModel)]="c.url" placeholder="https://res.cloudinary.com/…" /></div>
                <div><button type="button" class="btn btn-sm" (click)="certs.splice(i, 1)">Remove</button></div>
              </div>
            }
            <button type="button" class="btn btn-sm" (click)="certs.push({ name: '', url: '' })">+ Add document</button>

            <div class="pf-sub">Extra attributes (extensible schema, stored as JSON)</div>
            @for (e of extras; track $index; let i = $index) {
              <div class="form-row">
                <div class="field"><input [name]="'x_key_' + i" [(ngModel)]="e.key" placeholder="Attribute, e.g. mrvProvider" /></div>
                <div class="field"><input [name]="'x_val_' + i" [(ngModel)]="e.value" placeholder="Value" /></div>
                <div><button type="button" class="btn btn-sm" (click)="extras.splice(i, 1)">Remove</button></div>
              </div>
            }
            <button type="button" class="btn btn-sm" (click)="extras.push({ key: '', value: '' })">+ Add attribute</button>

            <div class="pf-review">
              <div class="pf-sub">Check before submitting</div>
              <div class="pf-review-grid">
                <div><span class="l">Source</span><div>{{ f.source || '—' }}</div></div>
                <div><span class="l">Capture</span><div>{{ f.captureTechnology || '—' }}</div></div>
                <div><span class="l">Meter</span><div>{{ f.meterId || '—' }}</div></div>
                <div><span class="l">Daily</span><div>{{ f.dailyTonnage }} t/day</div></div>
                <div><span class="l">Total volume</span><div>{{ f.totalVolumeTonnes }} t</div></div>
                <div><span class="l">Concentration</span><div>{{ f.concentrationPct }}%</div></div>
              </div>
            </div>
          }

          <div class="pf-foot">
            @if (step() === 1) {
              <a class="em-btn em-btn-out" routerLink="/emitter/passports">Cancel</a>
            } @else {
              <button type="button" class="em-btn em-btn-out" (click)="back()" [disabled]="busy()">Back</button>
            }
            <span class="pf-spacer"></span>
            <span class="pf-count">Step {{ step() }} of {{ lastStep }}</span>
            @if (step() < lastStep) {
              <button type="button" class="em-btn em-btn-green" (click)="next()">Next</button>
            } @else {
              <button type="submit" class="em-btn em-btn-green" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create passport' }}</button>
            }
          </div>
        </form>
      </main>
    </div>`,
})
export class PassportForm {
  private api = inject(ApiService);
  private router = inject(Router);
  impurities = IMPURITIES;
  steps = STEPS;
  lastStep = LAST_STEP;
  step = signal(1);
  busy = signal(false);
  error = signal<string | null>(null);
  /** Per-field messages, filled only when an advance or submit is attempted. */
  fe = signal<FieldErrors>({});
  imp: Record<string, number> = { H2O: 30, O2: 100, NOx: 15, SOx: 10, H2S: 2, CO: 10, N2: 4000 };
  certs: { name: string; url: string }[] = [{ name: '', url: '' }];
  extras: KV[] = [];
  f = {
    source: '', carbonOrigin: 'PROCESS', captureTechnology: '', meterId: '', dailyTonnage: 20, dailyTonnageMin: 18, dailyTonnageMax: 25, totalVolumeTonnes: 500,
    availabilityStart: toDateInput(new Date()), availabilityEnd: toDateInput(addDays(new Date(), 180)), captureTimestamp: toDateTimeInput(new Date()),
    concentrationPct: 96.5, physicalState: 'LIQUEFIED', pressureBar: 18, temperatureC: -25, locationName: '', latitude: 22.3, longitude: 70.8, pipelineConnected: false,
  };

  constructor() {
    this.api.myCompany().subscribe({ next: (c) => { this.f.latitude = c.latitude; this.f.longitude = c.longitude; this.f.locationName = `${c.name} — ${c.city}`; }, error: () => {} });
  }

  stepTitle(): string { return STEPS.find((s) => s.n === this.step())?.label ?? ''; }
  stepBlurb(): string { return STEPS.find((s) => s.n === this.step())?.sub ?? ''; }

  /**
   * Validates only the step on screen. Plain method, run fresh on every attempt: the fields are
   * ngModel-bound properties, not signals, so a computed() would never see them change.
   */
  private validate(step: number): Check {
    const c = new Check();
    const f = this.f;

    if (step === 1) {
      c.required('source', f.source, 'Source');
      c.required('captureTechnology', f.captureTechnology, 'Capture technology');
      c.required('meterId', f.meterId, 'Meter ID');
    }

    if (step === 2) {
      c.num('dailyTonnage', f.dailyTonnage, 'Daily availability', { gt: 0, unit: ' t/day' });
      if (!isBlank(f.dailyTonnageMin)) c.num('dailyTonnageMin', f.dailyTonnageMin, 'Range min', { min: 0, unit: ' t/day' });
      if (!isBlank(f.dailyTonnageMax)) c.num('dailyTonnageMax', f.dailyTonnageMax, 'Range max', { min: 0, unit: ' t/day' });
      c.when(!isBlank(f.dailyTonnageMin) && !isBlank(f.dailyTonnageMax) && Number(f.dailyTonnageMin) > Number(f.dailyTonnageMax),
        'dailyTonnageMax', 'Range max must be greater than or equal to range min.');
      c.num('totalVolumeTonnes', f.totalVolumeTonnes, 'Total volume offered', { gt: 0, unit: ' t' });
      c.required('availabilityStart', f.availabilityStart, 'Availability window start');
      c.required('availabilityEnd', f.availabilityEnd, 'Availability window end');
      c.when(Check.notAfter(f.availabilityStart, f.availabilityEnd), 'availabilityEnd', 'The availability window must end after it starts.');
      c.required('captureTimestamp', f.captureTimestamp, 'Capture timestamp');
    }

    if (step === 3) {
      c.num('concentrationPct', f.concentrationPct, 'CO₂ concentration', { gt: 0, max: 100, unit: '%' });
      if (!isBlank(f.pressureBar)) c.num('pressureBar', f.pressureBar, 'Pressure', { min: 0, unit: ' bar' });
      for (const i of this.impurities) {
        const v = this.imp[i];
        if (!isBlank(v)) c.num('imp_' + i, v, `${i} level`, { min: 0, unit: ' ppm' });
      }
    }

    if (step === 4) {
      c.required('locationName', f.locationName, 'Location name');
      c.num('latitude', f.latitude, 'Latitude', { min: -90, max: 90 });
      c.num('longitude', f.longitude, 'Longitude', { min: -180, max: 180 });
      // A document row is only useful with both halves filled in.
      const halfCert = this.certs.some((x) => (!!x.name.trim()) !== (!!x.url.trim()));
      c.when(halfCert, 'certs', 'Every certification needs both a document name and a link, or leave the row empty.');
    }
    return c;
  }

  next(): void {
    const c = this.validate(this.step());
    if (!c.ok) { this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    this.fe.set({}); this.error.set(null);
    this.step.update((s) => Math.min(LAST_STEP, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back(): void {
    this.fe.set({}); this.error.set(null);
    this.step.update((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.step() < LAST_STEP) { this.next(); return; }
    // Re-check every step, so a problem left behind on an earlier one cannot slip through.
    for (let s = 1; s <= LAST_STEP; s++) {
      const c = this.validate(s);
      if (!c.ok) { this.step.set(s); this.fe.set(c.errors); scrollToFirstInvalid(); return; }
    }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    const extra: Record<string, unknown> = {};
    for (const e of this.extras) if (e.key.trim()) extra[e.key.trim()] = e.value;
    const body: Partial<PassportDto> = {
      ...this.f,
      dailyTonnage: +this.f.dailyTonnage, dailyTonnageMin: +this.f.dailyTonnageMin, dailyTonnageMax: +this.f.dailyTonnageMax, totalVolumeTonnes: +this.f.totalVolumeTonnes,
      concentrationPct: +this.f.concentrationPct, pressureBar: +this.f.pressureBar, temperatureC: +this.f.temperatureC, latitude: +this.f.latitude, longitude: +this.f.longitude,
      captureTimestamp: new Date(this.f.captureTimestamp).toISOString(),
      impurities: Object.fromEntries(Object.entries(this.imp).map(([k, v]) => [k, +v])),
      certifications: this.certs.filter((c) => c.name.trim() || c.url.trim()),
      extraAttributes: extra, mrvStatus: 'ACTIVE',
    };
    this.api.createPassport(body).subscribe({
      next: (p) => { this.busy.set(false); this.router.navigate(['/emitter/passports', p.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
