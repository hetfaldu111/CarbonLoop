import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Alert } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

interface DemoAccount { email: string; label: string; note: string; }
interface DemoGroup { title: string; accounts: DemoAccount[]; }

/** Split so the two panels flank the card evenly. */
const LEFT: DemoGroup[] = [
  {
    title: 'Emitters',
    accounts: [
      { email: 'cement@carbon.local', label: 'Saurashtra Cement Works', note: 'Porbandar · tender + live auction' },
      { email: 'steel@carbon.local', label: 'Kalinga Steel Plant', note: 'Angul · two-winner tender' },
      { email: 'power@carbon.local', label: 'Kutch Thermal Power', note: 'Mundra · pipeline connected' },
    ],
  },
  {
    title: 'Platform',
    accounts: [
      { email: 'admin@carbon.local', label: 'Marketplace Admin', note: 'Approvals + company search' },
      { email: 'lab@carbon.local', label: 'National CO₂ Testing Lab', note: 'Verification queue' },
      { email: 'regulator@carbon.local', label: 'NITI CCUS Oversight Cell', note: 'Read-only oversight' },
    ],
  },
];

const RIGHT: DemoGroup[] = [
  {
    title: 'Utilizers',
    accounts: [
      { email: 'methanol@carbon.local', label: 'Gujarat Methanol Synthesis', note: 'Gold · cost estimator' },
      { email: 'algae@carbon.local', label: 'Bay of Bengal Algae Farms', note: 'Diamond · shipments' },
      { email: 'greenhouse@carbon.local', label: 'Sabarmati Agro Greenhouses', note: 'Silver · leading a bid' },
      { email: 'concrete@carbon.local', label: 'Carbonated Concrete Co', note: 'Bronze · high cancellations' },
    ],
  },
  {
    title: 'Transport',
    accounts: [
      { email: 'gujtrans@carbon.local', label: 'Saurashtra Cryo Logistics', note: 'Gujarat fleet' },
      { email: 'odtrans@carbon.local', label: 'East Coast Gas Carriers', note: 'Odisha · assigned shipment' },
    ],
  },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Alert],
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

      <!-- Hand-drawn molecules wandering across the page. Decorative only. -->
      <div class="doodle-layer" aria-hidden="true">
        <svg width="0" height="0" style="position:absolute">
          <defs>
            <!-- smiley face reused by every doodle -->
            <g id="ddFace">
              <circle cx="-3.2" cy="-1.6" r="1.05" fill="currentColor" />
              <circle cx="3.2" cy="-1.6" r="1.05" fill="currentColor" />
              <path d="M -3.6,2.2 Q 0,5.6 3.6,2.2" fill="none" stroke="currentColor"
                    stroke-width="1.5" stroke-linecap="round" />
            </g>

            <!-- O=C=O, the happy one -->
            <symbol id="ddCo2" viewBox="-52 -26 104 52">
              <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <path d="M -30,-2.4 H -16 M -30,2.4 H -16" />
                <path d="M 16,-2.4 H 30 M 16,2.4 H 30" />
                <circle cx="-38" cy="0" r="9" />
                <circle cx="38" cy="0" r="9" />
                <circle cx="0" cy="0" r="15" />
              </g>
              <use href="#ddFace" />
            </symbol>

            <!-- benzene ring, the chemistry everyone recognises -->
            <symbol id="ddRing" viewBox="-34 -34 68 68">
              <g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
                <path d="M 0,-26 L 22.5,-13 L 22.5,13 L 0,26 L -22.5,13 L -22.5,-13 Z" />
                <circle cx="0" cy="0" r="13" stroke-dasharray="3 4" />
              </g>
              <use href="#ddFace" />
            </symbol>

            <!-- a zig-zag carbon chain -->
            <symbol id="ddChain" viewBox="-56 -22 112 44">
              <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M -46,8 L -23,-8 L 0,8 L 23,-8 L 46,8" />
                <circle cx="-46" cy="8" r="4.5" />
                <circle cx="-23" cy="-8" r="4.5" />
                <circle cx="0" cy="8" r="4.5" />
                <circle cx="23" cy="-8" r="4.5" />
                <circle cx="46" cy="8" r="4.5" />
              </g>
            </symbol>

            <!-- little methane star -->
            <symbol id="ddMethane" viewBox="-26 -26 52 52">
              <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <path d="M 0,0 L 0,-17 M 0,0 L 16,9 M 0,0 L -16,9" />
                <circle cx="0" cy="-20" r="4" />
                <circle cx="19" cy="11" r="4" />
                <circle cx="-19" cy="11" r="4" />
                <circle cx="0" cy="0" r="8" />
              </g>
            </symbol>

            <!-- a doodled sparkle -->
            <symbol id="ddSpark" viewBox="-16 -16 32 32">
              <path d="M 0,-13 Q 1.6,-1.6 13,0 Q 1.6,1.6 0,13 Q -1.6,1.6 -13,0 Q -1.6,-1.6 0,-13 Z"
                    fill="currentColor" opacity="0.7" />
            </symbol>
          </defs>
        </svg>

        @for (d of doodles; track d.id) {
          <svg class="dd" [class]="'dd ' + d.path" [style.width.px]="d.size" [style.height.px]="d.size"
               [style.animation-duration]="d.dur" [style.animation-delay]="d.delay"
               [style.color]="d.tint" [style.opacity]="d.opacity" [attr.viewBox]="d.box">
            <use [attr.href]="'#' + d.sym" />
          </svg>
        }
      </div>

      <div class="login-grid">

        <!-- left demo panel -->
        <aside class="demo-panel left">
          @for (g of left; track g.title) {
            <div class="demo-group">
              <div class="demo-title">{{ g.title }}</div>
              @for (a of g.accounts; track a.email) {
                <button type="button" class="demo-row" (click)="use(a.email)" [class.active]="email === a.email">
                  <span class="demo-label">{{ a.label }}</span>
                  <span class="demo-mail">{{ a.email }}</span>
                  <span class="demo-note">{{ a.note }}</span>
                </button>
              }
            </div>
          }
        </aside>

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
            <div class="lf">
              <input id="email" type="email" name="email" [(ngModel)]="email" required autocomplete="username" placeholder=" " />
              <label for="email">Email</label>
            </div>
            <div class="lf">
              <input id="password" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" placeholder=" " />
              <label for="password">Password</label>
              <button type="button" class="peek" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">{{ show() ? 'Hide' : 'Show' }}</button>
            </div>

            <p class="login-hint">Only companies approved by the admin can sign in.</p>

            <div class="login-actions">
              <a routerLink="/register" class="link-quiet">Create account</a>
              <button class="btn-signin" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Next' }}</button>
            </div>
          </form>

          <p class="login-foot">Demo password for every account: <code>Password123!</code></p>
        </main>

        <!-- right demo panel -->
        <aside class="demo-panel right">
          @for (g of right; track g.title) {
            <div class="demo-group">
              <div class="demo-title">{{ g.title }}</div>
              @for (a of g.accounts; track a.email) {
                <button type="button" class="demo-row" (click)="use(a.email)" [class.active]="email === a.email">
                  <span class="demo-label">{{ a.label }}</span>
                  <span class="demo-mail">{{ a.email }}</span>
                  <span class="demo-note">{{ a.note }}</span>
                </button>
              }
            </div>
          }
        </aside>

      </div>
    </div>`,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  left = LEFT;
  right = RIGHT;

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
  doodles = [
    { id: 1, sym: 'ddCo2', box: '-52 -26 104 52', size: 104, path: 'p-a', dur: '52s', delay: '-4s', tint: '#2FA35C', opacity: 0.72 },
    { id: 2, sym: 'ddRing', box: '-34 -34 68 68', size: 74, path: 'p-b', dur: '61s', delay: '-22s', tint: '#1A3C2A', opacity: 0.54 },
    { id: 3, sym: 'ddChain', box: '-56 -22 112 44', size: 118, path: 'p-c', dur: '74s', delay: '-9s', tint: '#2FA35C', opacity: 0.56 },
    { id: 4, sym: 'ddCo2', box: '-52 -26 104 52', size: 72, path: 'p-d', dur: '66s', delay: '-31s', tint: '#4FBF7C', opacity: 0.64 },
    { id: 5, sym: 'ddMethane', box: '-26 -26 52 52', size: 58, path: 'p-e', dur: '48s', delay: '-15s', tint: '#1A3C2A', opacity: 0.52 },
    { id: 6, sym: 'ddRing', box: '-34 -34 68 68', size: 54, path: 'p-f', dur: '58s', delay: '-40s', tint: '#2FA35C', opacity: 0.58 },
    { id: 7, sym: 'ddChain', box: '-56 -22 112 44', size: 88, path: 'p-a', dur: '80s', delay: '-52s', tint: '#4FBF7C', opacity: 0.52 },
    { id: 8, sym: 'ddCo2', box: '-52 -26 104 52', size: 62, path: 'p-e', dur: '69s', delay: '-46s', tint: '#1A3C2A', opacity: 0.50 },
    { id: 9, sym: 'ddSpark', box: '-16 -16 32 32', size: 26, path: 'p-b', dur: '41s', delay: '-12s', tint: '#4FBF7C', opacity: 0.82 },
    { id: 10, sym: 'ddSpark', box: '-16 -16 32 32', size: 20, path: 'p-d', dur: '45s', delay: '-33s', tint: '#2FA35C', opacity: 0.77 },
    { id: 11, sym: 'ddMethane', box: '-26 -26 52 52', size: 44, path: 'p-c', dur: '56s', delay: '-27s', tint: '#4FBF7C', opacity: 0.56 },
    { id: 12, sym: 'ddRing', box: '-34 -34 68 68', size: 62, path: 'p-f', dur: '70s', delay: '-6s', tint: '#2FA35C', opacity: 0.52 },
    { id: 13, sym: 'ddCo2', box: '-52 -26 104 52', size: 88, path: 'p-f', dur: '63s', delay: '-18s', tint: '#2FA35C', opacity: 0.6 },
    { id: 14, sym: 'ddChain', box: '-56 -22 112 44', size: 96, path: 'p-b', dur: '77s', delay: '-58s', tint: '#1A3C2A', opacity: 0.45 },
    { id: 15, sym: 'ddSpark', box: '-16 -16 32 32', size: 24, path: 'p-e', dur: '39s', delay: '-25s', tint: '#4FBF7C', opacity: 0.7 },
  ];

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

  /** One click fills both fields so a demo account is a single extra click away. */
  use(email: string): void {
    this.email = email;
    this.password = 'Password123!';
    this.error.set(null);
  }

  submit(): void {
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
