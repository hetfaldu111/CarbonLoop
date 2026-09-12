import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PassportDto } from '../../core/models';
import { LabelPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-passports',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, LabelPipe, TonnesPipe, Alert, Loading],
  template: `
    <div class="em-page">
      @if (pendingCount() > 0) {
        <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2)">
          <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>
          <p style="font-family:'Outfit',sans-serif;font-size:13px;color:#92400e;margin:0">
            {{ pendingCount() }} CO₂ stream{{ pendingCount() === 1 ? ' is' : 's are' }} awaiting validation. A passport can only be listed once the lab approves it.
          </p>
        </div>
      }

      <div class="em-head">
        <h1 class="em-h1">CO₂ Passports</h1>
        <span class="em-spacer"></span>
        <div class="em-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(13,35,24,0.35)" stroke-width="1.5" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
          <input [ngModel]="term()" (ngModelChange)="term.set($event)" name="q" placeholder="Search passports…" aria-label="Search passports" />
        </div>
        <a class="em-btn em-btn-green" routerLink="/emitter/passports/new">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 2v10M2 7h10" /></svg>
          Create CO₂ Stream
        </a>
      </div>

      <app-alert [message]="error()" />
      @if (loading()) {<app-loading />}
      @else if (!filtered().length) {
        <div class="em-card"><div class="em-empty"><span class="ico">▤</span>{{ rows().length ? 'No passports match that search.' : 'No passports yet. Create your first CO₂ stream.' }}</div></div>
      }
      @else {
        <div class="em-grid em-grid-auto-lg">
          @for (p of filtered(); track p.id) {
            <a class="em-pass" [routerLink]="['/emitter/passports', p.id]">
              <div class="em-pass-top">
                <div class="dots"></div>
                <div class="in">
                  <div class="em-pass-kicker">CO₂ Passport</div>
                  <div class="em-pass-title">{{ p.source }}</div>
                  <div class="em-pass-chips">
                    @if (p.verificationStatus === 'VERIFIED') {<span class="em-chip-ok">✓ VERIFIED</span>}
                    @else if (p.verificationStatus === 'REJECTED') {<span class="em-chip-wait" style="color:#fca5a5;background:rgba(239,68,68,0.15)">✕ REJECTED</span>}
                    @else {<span class="em-chip-wait">⏳ PENDING</span>}
                    <span class="em-chip-mrv">MRV: {{ p.mrvStatus }}</span>
                  </div>
                </div>
              </div>

              <div class="em-pass-id">
                <span class="em-pid">{{ p.passportCode }}</span>
                <span class="em-mono">{{ p.meterId }}</span>
              </div>

              <div class="em-pass-body">
                <div><div class="em-f-label">CO₂ Conc.</div><div class="em-f-value sm">{{ p.concentrationPct | number:'1.1-1' }}%</div></div>
                <div><div class="em-f-label">Capture</div><div class="em-f-value sm">{{ p.captureTechnology }}</div></div>
                <div><div class="em-f-label">State</div><div class="em-f-value sm">{{ p.physicalState | label }}</div></div>
                <div><div class="em-f-label">Pressure</div><div class="em-f-value sm">{{ p.pressureBar }} bar</div></div>
                <div><div class="em-f-label">Temperature</div><div class="em-f-value sm">{{ p.temperatureC }} °C</div></div>
                <div><div class="em-f-label">Available</div><div class="em-f-value sm">{{ p.dailyTonnageMin }}–{{ p.dailyTonnageMax }} t/day</div></div>
                <div><div class="em-f-label">Total volume</div><div class="em-f-value sm">{{ p.totalVolumeTonnes | tonnes }}</div></div>
                <div><div class="em-f-label">Free stock</div><div class="em-f-value sm" style="color:#15803d">{{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</div></div>
                @if (impuritiesOf(p).length) {
                  <div style="grid-column:1/-1">
                    <div class="em-f-label">Impurities</div>
                    <div style="display:flex;flex-wrap:wrap;gap:5px">
                      @for (i of impuritiesOf(p); track i) {<span class="em-imp">{{ i }}</span>}
                    </div>
                  </div>
                }
              </div>

              <div class="em-pass-foot">
                <span class="em-mono">
                  @if (p.coaExpiresAt) {COA exp {{ p.coaExpiresAt | date:'mediumDate' }}}
                  @else {Capture {{ p.captureTimestamp | date:'short' }}}
                </span>
                <span class="em-link">Full details →</span>
              </div>
            </a>
          }
        </div>
      }
    </div>`,
})
export class Passports {
  private api = inject(ApiService);
  rows = signal<PassportDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  term = signal('');

  pendingCount = computed(() => this.rows().filter((p) => p.verificationStatus === 'PENDING').length);
  filtered = computed(() => {
    const t = this.term().trim().toLowerCase();
    if (!t) return this.rows();
    return this.rows().filter((p) =>
      [p.passportCode, p.source, p.captureTechnology, p.locationName, p.physicalState, p.verificationStatus, p.meterId]
        .some((v) => (v || '').toString().toLowerCase().includes(t)));
  });

  /** Impurity keys the emitter actually recorded, so nothing is invented for display. */
  impuritiesOf(p: PassportDto): string[] {
    const imp = p.impurities || {};
    return Object.keys(imp).filter((k) => Number(imp[k]) > 0);
  }

  constructor() {
    this.api.passports().subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
