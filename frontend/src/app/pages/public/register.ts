import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { INDIAN_STATES, RegisterRequest, Role, SECTORS } from '../../core/models';
import { Alert } from '../../shared/widgets';
import { LabelPipe } from '../../shared/pipes';
import { errMsg } from '../../shared/utils';

interface RoleProfile {
  captureTechnology?: string; annualCaptureCapacity?: number; emissionSource?: string;
  useCase?: string; annualDemand?: number; requiredPurity?: number;
  fleetPipeline?: boolean; fleetTruck?: boolean; fleetRail?: boolean; capacityPerDay?: number; serviceRadiusKm?: number;
  accreditationNumber?: string; testsOffered?: string; agency?: string; jurisdiction?: string;
}
interface RoleCard { role: Role; title: string; desc: string; icon: string; }
const ROLES: RoleCard[] = [
  { role: 'EMITTER', title: 'Carbon emitter', desc: 'Cement, steel, power, refinery… you capture CO₂ and want to sell it.', icon: '🏭' },
  { role: 'UTILIZER', title: 'Carbon utilizer', desc: 'Fuel synthesis, building materials, greenhouses, algae — you need CO₂.', icon: '🌱' },
  { role: 'TRANSPORT', title: 'Transport provider', desc: 'Pipeline, truck or rail logistics for liquefied / gaseous CO₂.', icon: '🚛' },
  { role: 'LAB', title: 'Verification lab', desc: 'Independent testing lab issuing Certificates of Analysis.', icon: '🔬' },
  { role: 'REGULATOR', title: 'Policy regulator', desc: 'Read-only oversight, compliance and incentive monitoring.', icon: '🏛' },
];

const STEPS = [
  { n: 1, label: 'Account & role' },
  { n: 2, label: 'Role details' },
  { n: 3, label: 'Location' },
];

/** Sectors that make sense per role, so step 2 does not offer all fourteen every time. */
const SECTORS_BY_ROLE: Record<Role, string[]> = {
  EMITTER: ['CEMENT', 'STEEL', 'POWER', 'REFINERY', 'CHEMICALS', 'OTHER'],
  UTILIZER: ['FUEL_SYNTHESIS', 'BUILDING_MATERIALS', 'GREENHOUSE', 'ALGAE', 'CHEMICALS', 'OTHER'],
  TRANSPORT: ['LOGISTICS'],
  LAB: ['LAB'],
  REGULATOR: ['GOVERNMENT'],
  ADMIN: ['OTHER'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, Alert, LabelPipe],
  template: `
    <div class="container">
      <div class="card auth-box wide">
        @if (done()) {
          <h2>Registration received</h2>
          <div class="alert alert-success">Awaiting admin approval. The platform admin will verify your company (form review plus a call or site visit) before you can log in and transact.</div>
          <a class="btn btn-primary" routerLink="/login">Back to login</a>
        } @else {
          <h2>Register your company</h2>
          <p class="muted">Three short steps. Every sign-up is manually verified by the admin before the account can transact.</p>

          <ol class="stepper">
            @for (s of steps; track s.n) {
              <li [class.current]="step() === s.n" [class.done]="step() > s.n">
                <span class="dot">@if (step() > s.n) {✓} @else {{{ s.n }}}</span>
                <span class="lbl">{{ s.label }}</span>
              </li>
            }
          </ol>

          <app-alert [message]="error()" />
          @if (errorsToShow().length) {
            <div class="alert alert-danger">
              <strong>Complete this step to continue:</strong>
              <ul class="mb0">@for (e of errorsToShow(); track e) {<li>{{ e }}</li>}</ul>
            </div>
          }

          <form class="form" (ngSubmit)="onSubmit()">

            <!-- ============ STEP 1 — account & role ============ -->
            @if (step() === 1) {
              <fieldset>
                <legend>Your company and login</legend>
                <div class="form-row">
                  <div class="field"><label>Company name</label><input name="companyName" [(ngModel)]="f.companyName" autocomplete="organization" /></div>
                  <div class="field"><label>Your full name</label><input name="fullName" [(ngModel)]="f.fullName" autocomplete="name" /></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Email (this is your login)</label><input type="email" name="email" [(ngModel)]="f.email" autocomplete="email" /></div>
                  <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="f.password" autocomplete="new-password" /><span class="hint">At least 8 characters.</span></div>
                  <div class="field"><label>Phone</label><input name="contactPhone" [(ngModel)]="f.contactPhone" autocomplete="tel" /></div>
                </div>
              </fieldset>
              <fieldset>
                <legend>What does your organisation do?</legend>
                <div class="role-cards">
                  @for (r of roles; track r.role) {
                    <div class="mode-card" [class.selected]="role() === r.role" (click)="pickRole(r.role)" role="button" tabindex="0" (keydown.enter)="pickRole(r.role)">
                      <div style="font-size:1.4rem">{{ r.icon }}</div><h4>{{ r.title }}</h4><p>{{ r.desc }}</p>
                    </div>
                  }
                </div>
              </fieldset>
            }

            <!-- ============ STEP 2 — role-specific ============ -->
            @if (step() === 2) {
              <fieldset>
                <legend>{{ roleTitle() }} details</legend>
                <div class="form-row">
                  <div class="field"><label>Sector</label>
                    <select name="sector" [(ngModel)]="f.sector">@for (s of sectorOptions(); track s) {<option [value]="s">{{ s | label }}</option>}</select>
                  </div>
                  <div class="field"><label>Registration number (CIN / GST)</label><input name="registrationNumber" [(ngModel)]="f.registrationNumber" /></div>
                </div>

                @switch (role()) {
                  @case ('EMITTER') {
                    <div class="form-row">
                      <div class="field"><label>Capture technology</label><input name="captureTechnology" [(ngModel)]="p.captureTechnology" placeholder="e.g. Amine capture" /></div>
                      <div class="field"><label>Annual capture capacity (t/yr)</label><input type="number" name="annualCaptureCapacity" [(ngModel)]="p.annualCaptureCapacity" /></div>
                      <div class="field"><label>Emission source</label><input name="emissionSource" [(ngModel)]="p.emissionSource" placeholder="e.g. Cement kiln flue gas" /></div>
                    </div>
                  }
                  @case ('UTILIZER') {
                    <div class="form-row">
                      <div class="field"><label>Use case</label><input name="useCase" [(ngModel)]="p.useCase" placeholder="e.g. Methanol synthesis" /></div>
                      <div class="field"><label>Annual CO₂ demand (t/yr)</label><input type="number" name="annualDemand" [(ngModel)]="p.annualDemand" /></div>
                      <div class="field"><label>Required purity (%)</label><input type="number" step="0.1" name="requiredPurity" [(ngModel)]="p.requiredPurity" /><span class="hint">Anything above a stream's measured purity is quoted as a purification cost.</span></div>
                    </div>
                  }
                  @case ('TRANSPORT') {
                    <div class="form-row">
                      <div class="field"><label>Fleet types</label>
                        <label class="check"><input type="checkbox" name="fleetPipeline" [(ngModel)]="p.fleetPipeline" /> Pipeline</label>
                        <label class="check"><input type="checkbox" name="fleetTruck" [(ngModel)]="p.fleetTruck" /> Cryogenic trucks</label>
                        <label class="check"><input type="checkbox" name="fleetRail" [(ngModel)]="p.fleetRail" /> Rail tankers</label>
                      </div>
                      <div class="field"><label>Capacity (t/day)</label><input type="number" name="capacityPerDay" [(ngModel)]="p.capacityPerDay" /></div>
                      <div class="field"><label>Service radius (km)</label><input type="number" name="serviceRadiusKm" [(ngModel)]="p.serviceRadiusKm" /><span class="hint">You are notified about shipments loading within this radius.</span></div>
                    </div>
                  }
                  @case ('LAB') {
                    <div class="form-row">
                      <div class="field"><label>Accreditation number (NABL)</label><input name="accreditationNumber" [(ngModel)]="p.accreditationNumber" /></div>
                      <div class="field"><label>Tests offered</label><input name="testsOffered" [(ngModel)]="p.testsOffered" placeholder="GC purity, moisture, sulphur species…" /></div>
                    </div>
                  }
                  @case ('REGULATOR') {
                    <div class="form-row">
                      <div class="field"><label>Agency</label><input name="agency" [(ngModel)]="p.agency" placeholder="e.g. NITI Aayog CCUS cell" /></div>
                      <div class="field"><label>Jurisdiction</label><input name="jurisdiction" [(ngModel)]="p.jurisdiction" placeholder="National / State" /></div>
                    </div>
                  }
                }
              </fieldset>
            }

            <!-- ============ STEP 3 — address ============ -->
            @if (step() === 3) {
              <fieldset>
                <legend>Where are you located?</legend>
                <div class="form-row">
                  <div class="field wide"><label>Street address</label><input name="address" [(ngModel)]="f.address" autocomplete="street-address" /></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>City</label><input name="city" [(ngModel)]="f.city" autocomplete="address-level2" /></div>
                  <div class="field"><label>State</label>
                    <select name="state" [(ngModel)]="f.state">@for (s of states; track s) {<option [value]="s">{{ s }}</option>}</select>
                  </div>
                  <div class="field"><label>Country</label><input name="country" [(ngModel)]="f.country" autocomplete="country-name" /></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Latitude</label><input type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude" /></div>
                  <div class="field"><label>Longitude</label><input type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude" /></div>
                </div>
                <p class="hint">Coordinates drive distance, transport cost and the 100 km radius used to notify transport providers, so please keep them accurate.</p>
              </fieldset>

              <fieldset>
                <legend>Check before submitting</legend>
                <div class="summary-grid">
                  <div><span class="muted small">Company</span><div>{{ f.companyName }}</div></div>
                  <div><span class="muted small">Role</span><div>{{ roleTitle() }}</div></div>
                  <div><span class="muted small">Sector</span><div>{{ f.sector | label }}</div></div>
                  <div><span class="muted small">Contact</span><div>{{ f.fullName }}</div></div>
                  <div><span class="muted small">Login email</span><div>{{ f.email }}</div></div>
                  <div><span class="muted small">Phone</span><div>{{ f.contactPhone }}</div></div>
                </div>
              </fieldset>
            }

            <div class="form-actions wizard-actions">
              @if (step() === 1) {
                <a class="btn" routerLink="/login">Cancel</a>
              } @else {
                <button type="button" class="btn" (click)="back()" [disabled]="busy()">Back</button>
              }
              <span class="spacer"></span>
              <span class="muted small">Step {{ step() }} of 3</span>
              @if (step() < 3) {
                <button type="button" class="btn btn-primary" (click)="next()">Next</button>
              } @else {
                <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit for verification' }}</button>
              }
            </div>
          </form>
        }
      </div>
    </div>`,
})
export class Register {
  private auth = inject(AuthService);
  roles = ROLES;
  sectors = SECTORS;
  states = INDIAN_STATES;
  steps = STEPS;

  step = signal(1);
  /**
   * Errors are surfaced only after the user tries to advance, so the form is not hostile on first
   * sight. Held in a signal rather than derived: the form fields are plain properties bound with
   * ngModel, not signals, so a computed() would never re-run when they change.
   */
  errorsToShow = signal<string[]>([]);
  role = signal<Role | null>(null);
  busy = signal(false);
  done = signal(false);
  error = signal<string | null>(null);

  f = { companyName: '', registrationNumber: '', sector: '', address: '', city: '', state: 'Gujarat', country: 'India', latitude: 22.3, longitude: 70.8, fullName: '', contactPhone: '', email: '', password: '' };
  p: RoleProfile = { fleetPipeline: false, fleetTruck: true, fleetRail: false };

  roleTitle(): string { return ROLES.find((r) => r.role === this.role())?.title ?? ''; }

  sectorOptions = computed(() => {
    const r = this.role();
    return r ? SECTORS_BY_ROLE[r] ?? this.sectors : this.sectors;
  });

  pickRole(r: Role): void {
    this.role.set(r);
    // Default the sector to the first one that fits the chosen role.
    this.f.sector = (SECTORS_BY_ROLE[r] ?? [])[0] ?? '';
    // Role-specific answers from a previously chosen role no longer apply.
    this.p = r === 'TRANSPORT' ? { fleetPipeline: false, fleetTruck: true, fleetRail: false } : {};
  }

  /** Only the keys that belong to the chosen role, so the stored profile carries no stray fields. */
  private profileForRole(role: Role): Record<string, unknown> {
    const p = this.p;
    switch (role) {
      case 'EMITTER': return { captureTechnology: p.captureTechnology, annualCaptureCapacity: p.annualCaptureCapacity, emissionSource: p.emissionSource };
      case 'UTILIZER': return { useCase: p.useCase, annualDemand: p.annualDemand, requiredPurity: p.requiredPurity };
      case 'TRANSPORT': return { fleetPipeline: !!p.fleetPipeline, fleetTruck: !!p.fleetTruck, fleetRail: !!p.fleetRail, capacityPerDay: p.capacityPerDay, serviceRadiusKm: p.serviceRadiusKm };
      case 'LAB': return { accreditationNumber: p.accreditationNumber, testsOffered: p.testsOffered };
      case 'REGULATOR': return { agency: p.agency, jurisdiction: p.jurisdiction };
      default: return {};
    }
  }

  /** Validates the step currently on screen. Plain method, evaluated fresh on every attempt. */
  private validate(): string[] {
    const s = this.step();
    const role = this.role();
    const e: string[] = [];
    const blank = (v: unknown) => !String(v ?? '').trim();

    if (s === 1) {
      if (blank(this.f.companyName)) e.push('Company name is required.');
      if (blank(this.f.fullName)) e.push('Your full name is required.');
      if (!EMAIL_RE.test(this.f.email.trim())) e.push('Enter a valid email address.');
      if (this.f.password.length < 8) e.push('Password must be at least 8 characters.');
      if (this.f.contactPhone.replace(/\D/g, '').length < 10) e.push('Enter a phone number with at least 10 digits.');
      if (!role) e.push('Choose the role that describes your organisation.');
    }

    if (s === 2) {
      if (blank(this.f.sector)) e.push('Select a sector.');
      if (blank(this.f.registrationNumber)) e.push('Registration number (CIN / GST) is required.');
      const pos = (v: unknown, label: string) => { if (v === undefined || v === null || Number(v) <= 0) e.push(`${label} must be greater than zero.`); };
      switch (role) {
        case 'EMITTER':
          if (blank(this.p.captureTechnology)) e.push('Capture technology is required.');
          pos(this.p.annualCaptureCapacity, 'Annual capture capacity');
          if (blank(this.p.emissionSource)) e.push('Emission source is required.');
          break;
        case 'UTILIZER':
          if (blank(this.p.useCase)) e.push('Use case is required.');
          pos(this.p.annualDemand, 'Annual CO₂ demand');
          if (this.p.requiredPurity === undefined || Number(this.p.requiredPurity) <= 0 || Number(this.p.requiredPurity) > 100) e.push('Required purity must be between 0 and 100%.');
          break;
        case 'TRANSPORT':
          if (!this.p.fleetPipeline && !this.p.fleetTruck && !this.p.fleetRail) e.push('Select at least one fleet type.');
          pos(this.p.capacityPerDay, 'Capacity per day');
          pos(this.p.serviceRadiusKm, 'Service radius');
          break;
        case 'LAB':
          if (blank(this.p.accreditationNumber)) e.push('Accreditation number is required.');
          if (blank(this.p.testsOffered)) e.push('List at least one test you offer.');
          break;
        case 'REGULATOR':
          if (blank(this.p.agency)) e.push('Agency is required.');
          if (blank(this.p.jurisdiction)) e.push('Jurisdiction is required.');
          break;
      }
    }

    if (s === 3) {
      if (blank(this.f.address)) e.push('Street address is required.');
      if (blank(this.f.city)) e.push('City is required.');
      if (blank(this.f.state)) e.push('State is required.');
      if (blank(this.f.country)) e.push('Country is required.');
      const lat = Number(this.f.latitude), lng = Number(this.f.longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) e.push('Latitude must be between -90 and 90.');
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) e.push('Longitude must be between -180 and 180.');
    }
    return e;
  }

  next(): void {
    const errors = this.validate();
    if (errors.length) { this.errorsToShow.set(errors); return; }
    this.errorsToShow.set([]);
    this.error.set(null);
    this.step.update((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back(): void {
    this.errorsToShow.set([]);
    this.error.set(null);
    this.step.update((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.step() < 3) { this.next(); return; }
    const errors = this.validate();
    if (errors.length) { this.errorsToShow.set(errors); return; }
    const role = this.role();
    if (!role) { this.step.set(1); this.errorsToShow.set(['Choose the role that describes your organisation.']); return; }

    this.busy.set(true); this.error.set(null);
    const req: RegisterRequest = {
      role, ...this.f,
      latitude: Number(this.f.latitude),
      longitude: Number(this.f.longitude),
      roleProfile: this.profileForRole(role),
    };
    this.auth.register(req).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e, 'Registration failed')); },
    });
  }
}
