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

interface RoleCard {
  role: Role;
  title: string;
  desc: string;
  /** Where this role sits in the loop, shown as a small caption under the title. */
  place: string;
  bullets: string[];
  /** Extra line shown in the information panel once this role is chosen. */
  fact: string;
}

const ROLES: RoleCard[] = [
  {
    role: 'EMITTER',
    title: 'Carbon emitter',
    desc: 'Cement, steel, power or refining — you capture CO₂ and want to sell it.',
    place: 'Start of the loop',
    bullets: ['Publish a CO₂ Passport per stream', 'Split volume across tenders and auctions', 'Pick your buyers'],
    fact: 'Emitters publish a CO₂ Passport per stream, then split its volume across tenders, auctions and long-term contracts.',
  },
  {
    role: 'UTILIZER',
    title: 'Carbon utilizer',
    desc: 'Fuel synthesis, building materials, greenhouses or algae — you need CO₂.',
    place: 'End of the loop',
    bullets: ['Browse verified supply', 'See delivered cost before you commit', 'Bid, tender or contract'],
    fact: 'Utilizers see the delivered cost broken into layers before committing: the gas, purification, transport and lab fees.',
  },
  {
    role: 'TRANSPORT',
    title: 'Transport provider',
    desc: 'Pipeline, cryogenic truck or rail logistics for liquefied and gaseous CO₂.',
    place: 'Moves the loop',
    bullets: ['Get notified near your depots', 'Quote and accept shipments', 'Record loading and delivery'],
    fact: 'Transport providers are notified about shipments loading within their own service radius.',
  },
  {
    role: 'LAB',
    title: 'Verification lab',
    desc: 'Independent testing lab issuing Certificates of Analysis for captured CO₂.',
    place: 'Guards the loop',
    bullets: ['Work a priority-ordered queue', 'Test claimed against measured specs', 'Issue or reject the certificate'],
    fact: 'Labs issue the Certificate of Analysis that a Passport needs before any of its volume can be listed.',
  },
  {
    role: 'REGULATOR',
    title: 'Policy regulator',
    desc: 'Read-only oversight of compliance, incentives and traded volumes.',
    place: 'Watches the loop',
    bullets: ['Aggregate flows by region and sector', 'Review compliance flags', 'Check incentive eligibility'],
    fact: 'Regulators get read-only oversight: aggregate flows by region and sector, plus compliance and incentive flags.',
  },
];

const STEPS = [
  { n: 1, label: 'Your details', sub: 'Company and login' },
  { n: 2, label: 'Choose your role', sub: 'Where you sit in the loop' },
  { n: 3, label: 'Role details', sub: 'What you do' },
  { n: 4, label: 'Location & review', sub: 'Where you are' },
];

/** One striking fact per step, shown prominently in the panel beside the form. */
const FACTS: Record<number, { text: string; tag: string }> = {
  1: {
    text: 'If cement were a country, it would be the third-largest CO₂ emitter on Earth — behind only China and the United States.',
    tag: 'Why this marketplace exists',
  },
  2: {
    text: 'One tonne of CO₂ fills roughly 500 cubic metres at room pressure. That is a three-bedroom house full of gas, for every single tonne traded here.',
    tag: 'Why it ships liquefied',
  },
  3: {
    text: 'Making one tonne of cement releases well over half a tonne of CO₂ before any fuel is burned — the chemistry of the kiln emits it directly.',
    tag: 'Process emissions',
  },
  4: {
    text: 'Around a quarter of the CO₂ released today will still be in the atmosphere in a thousand years. Anything captured and locked into a product stays out of that quarter.',
    tag: 'Why reuse matters',
  },
};

/** Sectors that make sense per role, so step 3 does not offer all fourteen every time. */
const SECTORS_BY_ROLE: Record<Role, string[]> = {
  EMITTER: ['CEMENT', 'STEEL', 'POWER', 'REFINERY', 'CHEMICALS', 'OTHER'],
  UTILIZER: ['FUEL_SYNTHESIS', 'BUILDING_MATERIALS', 'GREENHOUSE', 'ALGAE', 'CHEMICALS', 'OTHER'],
  TRANSPORT: ['LOGISTICS'],
  LAB: ['LAB'],
  REGULATOR: ['GOVERNMENT'],
  ADMIN: ['OTHER'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_STEP = 4;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, Alert, LabelPipe],
  template: `
    <div class="reg-page">
      @if (done()) {
        <div class="reg-done">
          <div class="reg-done-mark" aria-hidden="true">
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle cx="22" cy="22" r="20" fill="none" stroke="var(--eco)" stroke-width="2" />
              <path d="M 13,22.5 L 19.5,29 L 31,17" fill="none" stroke="var(--eco)" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h1>Registration received</h1>
          <p>Your company is queued for verification. The platform admin reviews every sign-up, with a
            call or site visit, before the account can log in and transact.</p>
          <a class="btn-signin" routerLink="/login">Back to sign in</a>
        </div>
      } @else {
        <div class="reg-shell">

          <!-- ===== step rail ===== -->
          <aside class="reg-rail" aria-label="Registration progress">
            <div class="reg-rail-head">
              <span class="reg-eyebrow">Create account</span>
              <h2>Join the loop</h2>
            </div>
            <ol>
              @for (s of steps; track s.n) {
                <li [class.current]="step() === s.n" [class.done]="step() > s.n">
                  <span class="rl-dot">@if (step() > s.n) {<span aria-hidden="true">✓</span>} @else {{{ s.n }}}</span>
                  <span class="rl-text">
                    <span class="rl-label">{{ s.n === 3 && role() ? roleTitle() + ' details' : s.label }}</span>
                    <span class="rl-sub">{{ s.sub }}</span>
                  </span>
                </li>
              }
            </ol>
            <p class="reg-rail-foot">Every sign-up is manually verified before it can transact.</p>
          </aside>

          <!-- ===== the form ===== -->
          <main class="reg-main">
            <header class="reg-head">
              <h1>{{ step() === 3 && role() ? roleTitle() + ' details' : stepTitle() }}</h1>
              <p class="muted">{{ stepBlurb() }}</p>
            </header>

            <app-alert [message]="error()" />
            @if (errorsToShow().length) {
              <div class="alert alert-danger">
                <strong>Complete this step to continue:</strong>
                <ul class="mb0">@for (e of errorsToShow(); track e) {<li>{{ e }}</li>}</ul>
              </div>
            }

            <form class="form" (ngSubmit)="onSubmit()">

              <!-- ===== STEP 1 — your details ===== -->
              @if (step() === 1) {
                <div class="form-row">
                  <div class="field"><label>Company name</label><input name="companyName" [(ngModel)]="f.companyName" autocomplete="organization" /></div>
                  <div class="field"><label>Your full name</label><input name="fullName" [(ngModel)]="f.fullName" autocomplete="name" /></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Email (this is your login)</label><input type="email" name="email" [(ngModel)]="f.email" autocomplete="email" /></div>
                  <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="f.password" autocomplete="new-password" /><span class="hint">At least 8 characters.</span></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Phone</label><input name="contactPhone" [(ngModel)]="f.contactPhone" autocomplete="tel" /></div>
                </div>
              }

              <!-- ===== STEP 2 — choose your role ===== -->
              @if (step() === 2) {
                <div class="role-pick" role="group" aria-label="Choose your role">
                  @for (r of roles; track r.role) {
                    <button type="button" class="role-opt" [class.selected]="role() === r.role"
                            [attr.aria-pressed]="role() === r.role" (click)="pickRole(r.role)">
                      <span class="role-art" aria-hidden="true">
                        @switch (r.role) {
                          @case ('EMITTER') {
                            <svg viewBox="0 0 72 56" width="72" height="56">
                              <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 8,48 V 26 l 12,7 V 26 l 12,7 V 20 h 16 v 28 Z" />
                                <path d="M 44,20 V 10 h 6 v 10" />
                                <circle cx="60" cy="26" r="8" />
                                <path d="M 60,20 v 12 M 54,26 h 12" />
                                <path d="M 14,14 q 3,-5 6,0 t 6,0" opacity="0.75" />
                                <path d="M 16,6 q 3,-5 6,0 t 6,0" opacity="0.5" />
                              </g>
                            </svg>
                          }
                          @case ('UTILIZER') {
                            <svg viewBox="0 0 72 56" width="72" height="56">
                              <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 28,8 h 12 M 34,8 v 14 L 22,44 a 4,4 0 0 0 3.5,6 h 21 A 4,4 0 0 0 50,44 L 38,22 V 8" />
                                <path d="M 27,34 h 18" opacity="0.6" />
                                <circle cx="32" cy="41" r="2.2" />
                                <circle cx="41" cy="44" r="1.6" />
                                <path d="M 58,26 q 8,-4 8,-12 q -9,1 -8,12 Z" />
                                <path d="M 58,26 v 8" />
                              </g>
                            </svg>
                          }
                          @case ('TRANSPORT') {
                            <svg viewBox="0 0 72 56" width="72" height="56">
                              <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="6" y="20" width="34" height="18" rx="9" />
                                <path d="M 40,24 h 10 l 8,8 v 6 H 40 Z" />
                                <circle cx="18" cy="44" r="5" />
                                <circle cx="50" cy="44" r="5" />
                                <path d="M 14,29 h 18" opacity="0.6" />
                                <path d="M 62,16 h 6 M 60,22 h 8" opacity="0.55" />
                              </g>
                            </svg>
                          }
                          @case ('LAB') {
                            <svg viewBox="0 0 72 56" width="72" height="56">
                              <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 16,8 h 12 M 22,8 v 12 L 12,40 a 4,4 0 0 0 3.5,6 h 19 A 4,4 0 0 0 38,40 L 28,20 V 8" />
                                <path d="M 16,32 h 18" opacity="0.6" />
                                <rect x="42" y="14" width="22" height="28" rx="3" />
                                <path d="M 47,22 h 12 M 47,28 h 12 M 47,34 h 7" opacity="0.65" />
                                <circle cx="58" cy="38" r="5" />
                                <path d="M 61.5,41.5 L 66,46" />
                              </g>
                            </svg>
                          }
                          @case ('REGULATOR') {
                            <svg viewBox="0 0 72 56" width="72" height="56">
                              <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 8,22 L 30,10 L 52,22" />
                                <path d="M 10,22 v 22 M 50,22 v 22 M 6,46 h 48" />
                                <path d="M 20,26 v 16 M 30,26 v 16 M 40,26 v 16" opacity="0.7" />
                                <circle cx="58" cy="30" r="8" />
                                <path d="M 63.5,35.5 L 68,40" />
                              </g>
                            </svg>
                          }
                        }
                      </span>
                      <span class="role-body">
                        <span class="role-place">{{ r.place }}</span>
                        <span class="role-title">{{ r.title }}</span>
                        <span class="role-desc">{{ r.desc }}</span>
                        <span class="role-bullets">
                          @for (b of r.bullets; track b) {<span class="role-bullet">{{ b }}</span>}
                        </span>
                      </span>
                      <span class="role-tick" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path d="M 5,12.5 L 10,17.5 L 19,7" fill="none" stroke="currentColor"
                                stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </span>
                    </button>
                  }
                </div>
              }

              <!-- ===== STEP 3 — role-specific ===== -->
              @if (step() === 3) {
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
                    </div>
                    <div class="form-row">
                      <div class="field"><label>Emission source</label><input name="emissionSource" [(ngModel)]="p.emissionSource" placeholder="e.g. Cement kiln flue gas" /></div>
                    </div>
                  }
                  @case ('UTILIZER') {
                    <div class="form-row">
                      <div class="field"><label>Use case</label><input name="useCase" [(ngModel)]="p.useCase" placeholder="e.g. Methanol synthesis" /></div>
                      <div class="field"><label>Annual CO₂ demand (t/yr)</label><input type="number" name="annualDemand" [(ngModel)]="p.annualDemand" /></div>
                    </div>
                    <div class="form-row">
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
              }

              <!-- ===== STEP 4 — location & review ===== -->
              @if (step() === 4) {
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

                <div class="reg-review">
                  <div class="reg-review-head">Check before submitting</div>
                  <div class="summary-grid">
                    <div><span class="muted small">Company</span><div>{{ f.companyName }}</div></div>
                    <div><span class="muted small">Contact</span><div>{{ f.fullName }}</div></div>
                    <div><span class="muted small">Login email</span><div>{{ f.email }}</div></div>
                    <div><span class="muted small">Phone</span><div>{{ f.contactPhone }}</div></div>
                    <div><span class="muted small">Role</span><div>{{ roleTitle() }}</div></div>
                    <div><span class="muted small">Sector</span><div>{{ f.sector | label }}</div></div>
                    <div><span class="muted small">Registration no.</span><div>{{ f.registrationNumber }}</div></div>
                    <div><span class="muted small">Location</span><div>{{ f.city }}, {{ f.state }}</div></div>
                  </div>
                </div>
              }

              <div class="reg-actions">
                @if (step() === 1) {
                  <a class="btn-ghost" routerLink="/login">Cancel</a>
                } @else {
                  <button type="button" class="btn-ghost" (click)="back()" [disabled]="busy()">Back</button>
                }
                <span class="spacer"></span>
                <span class="reg-count">Step {{ step() }} of {{ lastStep }}</span>
                @if (step() < lastStep) {
                  <button type="button" class="btn-signin" (click)="next()" [disabled]="step() === 2 && !role()">Next</button>
                } @else {
                  <button type="submit" class="btn-signin" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit for verification' }}</button>
                }
              </div>
            </form>
          </main>

          <!-- ===== information panel ===== -->
          <aside class="reg-aside">
            <div class="fact-card">
              <div class="fact-head">
                <span class="fact-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M 9,18 h 6 M 10,21.5 h 4" />
                      <path d="M 12,2.5 a 6.5,6.5 0 0 1 4,11.7 V 18 h -8 v -3.8 A 6.5,6.5 0 0 1 12,2.5 Z" />
                    </g>
                  </svg>
                </span>
                <span class="fact-label">Did you know</span>
              </div>
              <p class="fact-text">{{ fact().text }}</p>
              <div class="fact-tag">{{ fact().tag }}</div>
              @if (step() === 2 && roleFact()) {
                <p class="fact-role">{{ roleFact() }}</p>
              }
            </div>
          </aside>

        </div>
      }
    </div>`,
})
export class Register {
  private auth = inject(AuthService);
  roles = ROLES;
  sectors = SECTORS;
  states = INDIAN_STATES;
  steps = STEPS;
  lastStep = LAST_STEP;

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
  p: RoleProfile = {};

  roleTitle(): string { return ROLES.find((r) => r.role === this.role())?.title ?? ''; }

  stepTitle = computed(() => STEPS.find((s) => s.n === this.step())?.label ?? '');

  stepBlurb = computed(() => {
    switch (this.step()) {
      case 1: return 'Tell us who you are. This email becomes your login.';
      case 2: return 'Pick the place your organisation occupies in the carbon loop. It decides what you can do here.';
      case 3: return 'A few specifics so buyers, sellers and the verification lab know what to expect from you.';
      default: return 'Where you operate, then a last look over everything before it goes to the admin.';
    }
  });

  fact = computed(() => FACTS[this.step()] ?? FACTS[1]);
  roleFact = computed(() => ROLES.find((r) => r.role === this.role())?.fact ?? '');

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
    this.errorsToShow.set([]);
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
    }

    if (s === 2) {
      if (!role) e.push('Choose the role that describes your organisation.');
    }

    if (s === 3) {
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

    if (s === 4) {
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
    this.step.update((s) => Math.min(LAST_STEP, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back(): void {
    this.errorsToShow.set([]);
    this.error.set(null);
    this.step.update((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubmit(): void {
    if (this.step() < LAST_STEP) { this.next(); return; }
    const errors = this.validate();
    if (errors.length) { this.errorsToShow.set(errors); return; }
    const role = this.role();
    if (!role) { this.step.set(2); this.errorsToShow.set(['Choose the role that describes your organisation.']); return; }

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
