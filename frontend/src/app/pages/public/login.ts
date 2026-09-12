import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Alert, FieldError } from '../../shared/widgets';
import { DoodleBackdrop } from '../../shared/doodle-backdrop';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

interface DemoAccount { email: string; label: string; note: string; role: string; }

/** Every seeded demo account, filterable by role. */
const DEMO: DemoAccount[] = [
  { email: 'cement@carbon.local', label: 'Saurashtra Cement Works', note: 'Porbandar · tender + live auction', role: 'Emitter' },
  { email: 'steel@carbon.local', label: 'Kalinga Steel Plant', note: 'Angul · two-winner tender', role: 'Emitter' },
  { email: 'power@carbon.local', label: 'Kutch Thermal Power', note: 'Mundra · pipeline connected', role: 'Emitter' },
  { email: 'methanol@carbon.local', label: 'Gujarat Methanol Synthesis', note: 'Gold · cost estimator', role: 'Utilizer' },
  { email: 'algae@carbon.local', label: 'Bay of Bengal Algae Farms', note: 'Diamond · shipments', role: 'Utilizer' },
  { email: 'greenhouse@carbon.local', label: 'Sabarmati Agro Greenhouses', note: 'Silver · leading a bid', role: 'Utilizer' },
  { email: 'concrete@carbon.local', label: 'Carbonated Concrete Co', note: 'Bronze · high cancellations', role: 'Utilizer' },
  { email: 'gujtrans@carbon.local', label: 'Saurashtra Cryo Logistics', note: 'Gujarat fleet', role: 'Transport' },
  { email: 'odtrans@carbon.local', label: 'East Coast Gas Carriers', note: 'Odisha · assigned shipment', role: 'Transport' },
  { email: 'lab@carbon.local', label: 'National CO₂ Testing Lab', note: 'Verification queue', role: 'Lab' },
  { email: 'regulator@carbon.local', label: 'NITI CCUS Oversight Cell', note: 'Read-only oversight', role: 'Regulator' },
  { email: 'admin@carbon.local', label: 'Marketplace Admin', note: 'Approvals + company search', role: 'Admin' },
];

const DEMO_FILTERS = ['All', 'Emitter', 'Utilizer', 'Transport', 'Lab', 'Regulator', 'Admin'];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Alert, FieldError, DoodleBackdrop],
  template: `
    <div class="login-page">

      <!-- Ambient carbon-loop backdrop. Decorative only. -->
      <div class="login-bg" aria-hidden="true">
        <svg viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="lgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#30BE69" stop-opacity="0.22" />
              <stop offset="55%" stop-color="#30BE69" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#30BE69" stop-opacity="0" />
            </radialGradient>
            <!-- one shared circular track per radius -->
            <path id="lgTrack270" d="M 450,180 a 270,270 0 1,1 0,540 a 270,270 0 1,1 0,-540" />
            <path id="lgTrack200" d="M 450,250 a 200,200 0 1,1 0,400 a 200,200 0 1,1 0,-400" />
            <g id="lgMolecule">
              <circle cx="-11" cy="0" r="5.5" fill="#30BE69" opacity="0.7" />
              <circle cx="0" cy="0" r="7.5" fill="#1A3C2A" opacity="0.85" />
              <circle cx="11" cy="0" r="5.5" fill="#30BE69" opacity="0.7" />
              <line x1="-11" y1="0" x2="11" y2="0" stroke="#1A3C2A" stroke-width="1.3" opacity="0.45" />
            </g>
          </defs>

          <circle cx="450" cy="450" r="430" fill="url(#lgGlow)" />

          <!-- rings: outer and inner turn in opposite directions -->
          <g class="lg-spin-cw">
            <circle cx="450" cy="450" r="340" fill="none" stroke="#1A3C2A" stroke-opacity="0.2"
                    stroke-width="1.2" stroke-dasharray="2 14" stroke-linecap="round" />
          </g>
          <circle cx="450" cy="450" r="305" fill="none" stroke="#30BE69" stroke-opacity="0.16" stroke-width="1.1" />
          <g class="lg-spin-ccw">
            <circle cx="450" cy="450" r="200" fill="none" stroke="#1A3C2A" stroke-opacity="0.24"
                    stroke-width="1.4" stroke-dasharray="18 12" stroke-linecap="round" />
          </g>
          <circle class="lg-breathe" cx="450" cy="450" r="130" fill="none"
                  stroke="#30BE69" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="1 9" stroke-linecap="round" />

          <!-- the loop itself, drawn as a travelling arc -->
          <circle class="lg-trace" cx="450" cy="450" r="270" fill="none"
                  stroke="#30BE69" stroke-opacity="0.62" stroke-width="2.6" stroke-linecap="round" />

          <!-- four stage nodes on the loop -->
          @for (s of stages; track s.label) {
            <g class="lg-node" [style.animation-delay]="s.delay">
              <circle [attr.cx]="s.x" [attr.cy]="s.y" r="7" fill="#EFF5F0" stroke="#1A3C2A" stroke-opacity="0.45" stroke-width="1.3" />
              <circle [attr.cx]="s.x" [attr.cy]="s.y" r="2.6" fill="#30BE69" />
            </g>
          }

          <!-- CO2 molecules riding the loop -->
          @for (m of molecules; track m.begin) {
            <use href="#lgMolecule" opacity="0.9">
              <animateMotion [attr.dur]="m.dur" repeatCount="indefinite" [attr.begin]="m.begin"
                             rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                <mpath href="#lgTrack270" />
              </animateMotion>
            </use>
          }
          <use href="#lgMolecule" opacity="0.5" transform="scale(0.72)" transform-origin="450 450">
            <animateMotion dur="26s" repeatCount="indefinite" begin="-6s" rotate="auto">
              <mpath href="#lgTrack200" />
            </animateMotion>
          </use>

          <!-- drifting motes -->
          @for (d of motes; track d.cx) {
            <circle class="lg-mote" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r"
                    fill="#30BE69" [style.animation-duration]="d.dur" [style.animation-delay]="d.delay" />
          }
        </svg>
      </div>

      <app-doodle-backdrop />

      <div class="login-col">

        <!-- centre card -->
        <main class="login-card">
          <div class="login-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <circle cx="16" cy="16" r="14" fill="none" stroke="var(--forest, #1A3C2A)" stroke-width="2" />
              <circle cx="16" cy="16" r="5" fill="var(--eco, #30BE69)" />
            </svg>
          </div>
          <h1>Sign in</h1>
          <p class="login-sub">Continue to CarbonLoop</p>

          <app-alert [message]="error()" />

          <form class="login-form" (ngSubmit)="submit()">
            <div class="lf" [class.invalid]="fe()['email']">
              <input id="email" type="email" name="email" [(ngModel)]="email" required autocomplete="username" placeholder=" "
                     [attr.aria-invalid]="fe()['email'] ? 'true' : null" />
              <label for="email">Email</label>
            </div>
            <app-field-error [msg]="fe()['email']" />
            <div class="lf" [class.invalid]="fe()['password']">
              <input id="password" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" placeholder=" "
                     [attr.aria-invalid]="fe()['password'] ? 'true' : null" />
              <label for="password">Password</label>
              <button type="button" class="peek" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">{{ show() ? 'Hide' : 'Show' }}</button>
            </div>
            <app-field-error [msg]="fe()['password']" />

            <p class="login-hint">Only companies approved by the admin can sign in.</p>

            <div class="login-actions">
              <a routerLink="/register" class="link-quiet">Create account</a>
              <button class="btn-signin" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Next' }}</button>
            </div>
          </form>

          <p class="login-foot">Demo password for every account: <code>Password123!</code></p>
        </main>


        <!-- compact demo chooser, below the card -->
        <section class="demo-try" aria-label="Try a demo account">
          <div class="demo-try-head">Try a demo account</div>
          <div class="demo-chips" role="group" aria-label="Filter demo accounts by role">
            @for (fl of filters; track fl) {
              <button type="button" class="demo-chip" [class.on]="filter() === fl" (click)="filter.set(fl)">{{ fl }}</button>
            }
          </div>
          <div class="demo-pills">
            @for (a of visible(); track a.email) {
              <button type="button" class="demo-pill" [class.active]="email === a.email"
                      (click)="use(a.email)" [attr.title]="a.note">
                <span class="dp-name">{{ a.label }}</span>
                <span class="dp-mail">{{ a.email }}</span>
              </button>
            }
          </div>
        </section>

      </div>
    </div>`,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  filters = DEMO_FILTERS;
  filter = signal('All');
  visible = computed(() => {
    const f = this.filter();
    return f === 'All' ? DEMO : DEMO.filter((a) => a.role === f);
  });

  /** Four stage nodes sitting on the r=270 loop at 12, 3, 6 and 9 o'clock. */
  stages = [
    { label: 'capture', x: 450, y: 180, delay: '0s' },
    { label: 'passport', x: 720, y: 450, delay: '1.5s' },
    { label: 'transport', x: 450, y: 720, delay: '3s' },
    { label: 'utilize', x: 180, y: 450, delay: '4.5s' },
  ];
  /** Staggered negative begins so the molecules are already spread around the loop on load. */
  molecules = [
    { dur: '18s', begin: '0s' },
    { dur: '18s', begin: '-4.5s' },
    { dur: '18s', begin: '-9s' },
    { dur: '18s', begin: '-13.5s' },
  ];
  /**
   * Wandering doodles. Values are fixed rather than random so the layout is identical on
   * every load; the variety of paths, speeds and delays is what reads as random.
   */

  motes = [
    { cx: 170, cy: 700, r: 3, dur: '13s', delay: '0s' },
    { cx: 300, cy: 780, r: 2, dur: '17s', delay: '2s' },
    { cx: 620, cy: 750, r: 2.5, dur: '15s', delay: '4s' },
    { cx: 760, cy: 690, r: 2, dur: '19s', delay: '1s' },
    { cx: 240, cy: 320, r: 2, dur: '21s', delay: '6s' },
    { cx: 690, cy: 270, r: 2.5, dur: '16s', delay: '3s' },
  ];
  email = '';
  password = '';
  show = signal(false);
  busy = signal(false);
  error = signal<string | null>(null);
  /** Per-field messages, filled only when a sign-in is attempted. */
  fe = signal<FieldErrors>({});

  /** One click fills both fields so a demo account is a single extra click away. */
  use(email: string): void {
    this.email = email;
    this.password = 'Password123!';
    this.error.set(null);
    this.fe.set({});
  }

  submit(): void {
    const c = new Check();
    c.email('email', this.email);
    c.required('password', this.password, 'Password');
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.busy.set(false);
        const ret = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(ret || this.auth.homeFor(res.user.role));
      },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e, 'Login failed')); },
    });
  }
}
