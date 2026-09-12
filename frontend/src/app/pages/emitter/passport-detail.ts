import { Component, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PassportDto } from '../../core/models';
import { StatusBadge } from '../../shared/badges';
import { LabelPipe, TonnesPipe } from '../../shared/pipes';
import { Alert, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-passport-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge, LabelPipe, TonnesPipe, Alert, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    @if (p(); as p) {
      <app-page-header [title]="p.passportCode" [subtitle]="p.source + ' · ' + p.captureTechnology + ' · ' + p.locationName">
        <app-status-badge [value]="p.verificationStatus" />
        <app-status-badge [value]="'MRV ' + p.mrvStatus" />
        @if (p.verificationStatus === 'VERIFIED') {<a class="btn btn-primary btn-sm" [routerLink]="['/emitter/listings/new']" [queryParams]="{ passportId: p.id }">List CO₂ from this passport</a>}
      </app-page-header>

      <!-- Left column: identity above volume. Right column: impurities alongside both. -->
      <div class="pp-cols">
        <div class="pp-left">
          <div class="card">
            <h3>Identity &amp; source</h3>
            <dl class="kv">
              <dt>Producer</dt><dd>{{ p.emitterName || '—' }}</dd>
              <dt>Source</dt><dd>{{ p.source }}</dd>
              <dt>Carbon origin</dt><dd>{{ p.carbonOrigin | label }}</dd>
              <dt>Capture technology</dt><dd>{{ p.captureTechnology }}</dd>
              <dt>Meter ID</dt><dd class="mono">{{ p.meterId }}</dd>
              <dt>Capture timestamp</dt><dd>{{ p.captureTimestamp | date:'medium' }}</dd>
              <dt>Location</dt><dd>{{ p.locationName }}<div class="muted small">{{ p.latitude }}, {{ p.longitude }} · {{ p.pipelineConnected ? 'pipeline-connected' : 'no pipeline' }}</div></dd>
            </dl>
          </div>
          <div class="card">
            <h3>Volume &amp; state</h3>
            <dl class="kv">
              <dt>Available</dt><dd>{{ p.dailyTonnage }} t/day <span class="muted small">(range {{ p.dailyTonnageMin }}–{{ p.dailyTonnageMax }})</span></dd>
              <dt>Total volume</dt><dd>{{ p.totalVolumeTonnes | tonnes }}</dd>
              <dt>Allocated / free</dt><dd>{{ p.allocatedTonnes | tonnes }} / {{ p.totalVolumeTonnes - p.allocatedTonnes | tonnes }}</dd>
              <dt>Window</dt><dd>{{ p.availabilityStart | date:'mediumDate' }} → {{ p.availabilityEnd | date:'mediumDate' }}</dd>
              <dt>CO₂ concentration</dt><dd><strong>{{ p.concentrationPct | number:'1.1-2' }}%</strong></dd>
              <dt>State</dt><dd>{{ p.physicalState | label }}</dd>
              <dt>Pressure / temp</dt><dd>{{ p.pressureBar }} bar · {{ p.temperatureC }} °C</dd>
            </dl>
          </div>
        </div>

        <div class="pp-right">
          <div class="card">
            <h3>Impurities &amp; verification</h3>
            <table class="table compact"><thead><tr><th>Impurity</th><th class="r">ppm</th></tr></thead><tbody>@for (e of entries(p.impurities); track e[0]) {<tr><td>{{ e[0] }}</td><td class="r">{{ e[1] }}</td></tr>}</tbody></table>
          </div>
        </div>
      </div>
    }`,
})
export class PassportDetail {
  id = input.required<string>();
  private api = inject(ApiService);
  p = signal<PassportDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.passport(this.id()).subscribe({
      next: (p) => { this.p.set(p); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
  entries(o: Record<string, number> | null | undefined): [string, number][] { return o ? Object.entries(o) : []; }
}
