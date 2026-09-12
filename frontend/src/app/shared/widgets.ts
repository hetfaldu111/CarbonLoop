import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AllocationDto, CostEstimateDto } from '../core/models';
import { LabelPipe, MoneyPipe, TonnesPipe } from './pipes';

@Component({
  selector: 'app-field-error',
  template: `@if (msg()) {<span class="field-error"><span class="fe-ico" aria-hidden="true">!</span>{{ msg() }}</span>}`,
})
export class FieldError {
  msg = input<string | undefined | null>();
}

@Component({
  selector: 'app-page-header',
  template: `
    <div class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {<p class="muted">{{ subtitle() }}</p>}
      </div>
      <div class="page-actions"><ng-content /></div>
    </div>`,
})
export class PageHeader {
  title = input.required<string>();
  subtitle = input<string>();
}

@Component({
  selector: 'app-empty-state',
  template: `<div class="empty-state"><div class="empty-icon">{{ icon() }}</div><p>{{ message() }}</p><ng-content /></div>`,
})
export class EmptyState {
  message = input('Nothing here yet.');
  icon = input('◌');
}

@Component({
  selector: 'app-loading',
  template: `<div class="loading"><span class="spinner"></span> {{ label() }}</div>`,
})
export class Loading {
  label = input('Loading…');
}

@Component({
  selector: 'app-alert',
  template: `@if (message()) {<div class="alert alert-{{ tone() }}">{{ message() }}</div>}`,
})
export class Alert {
  message = input<string | null | undefined>();
  tone = input<'error' | 'success' | 'info' | 'warn'>('error');
}

@Component({
  selector: 'app-allocation-bar',
  imports: [TonnesPipe, DecimalPipe],
  template: `
    <div class="alloc">
      <div class="stacked-bar" [title]="'Total ' + (a().totalVolumeTonnes | tonnes)">
        <div class="seg seg-tender" [style.width.%]="pct(a().allocatedTender)" title="Tender"></div>
        <div class="seg seg-auction" [style.width.%]="pct(a().allocatedAuction)" title="Auction"></div>
        <div class="seg seg-contract" [style.width.%]="pct(a().allocatedContract)" title="Contract"></div>
        <div class="seg seg-free" [style.width.%]="pct(a().freeTonnes)" title="Free"></div>
      </div>
      <div class="legend">
        <span><i class="sw seg-tender"></i>Tender {{ a().allocatedTender | tonnes }} ({{ pct(a().allocatedTender) | number:'1.0-0' }}%)</span>
        <span><i class="sw seg-auction"></i>Auction {{ a().allocatedAuction | tonnes }} ({{ pct(a().allocatedAuction) | number:'1.0-0' }}%)</span>
        <span><i class="sw seg-contract"></i>Contract {{ a().allocatedContract | tonnes }} ({{ pct(a().allocatedContract) | number:'1.0-0' }}%)</span>
        <span><i class="sw seg-free"></i>Free {{ a().freeTonnes | tonnes }} ({{ pct(a().freeTonnes) | number:'1.0-0' }}%)</span>
        <span class="muted">Total {{ a().totalVolumeTonnes | tonnes }}</span>
      </div>
    </div>`,
})
export class AllocationBar {
  a = input.required<AllocationDto>();
  pct(v: number): number { const t = this.a().totalVolumeTonnes; return t > 0 ? Math.max(0, Math.min(100, (v / t) * 100)) : 0; }
}


@Component({
  selector: 'app-cost-stack',
  imports: [MoneyPipe, TonnesPipe, DecimalPipe, LabelPipe],
  template: `
    <div class="cost-stack">
      <div class="cost-money">
        <h3>Cost stack <span class="muted small">— {{ c().quantityTonnes | tonnes }} · {{ c().transportMode | label }} · {{ c().distanceKm | number:'1.0-0' }} km</span></h3>
        <table class="table compact">
          <thead><tr><th>#</th><th>Layer</th><th class="r">Per tonne</th><th class="r">Amount</th><th>Basis</th></tr></thead>
          <tbody>
            @for (l of c().layers; track l.name; let i = $index) {
              <tr>
                <td>{{ i + 1 }}</td><td>{{ l.name }}</td>
                <td class="r">{{ l.perTonne | money:0 }}</td><td class="r">{{ l.amount | money:0 }}</td>
                <td class="muted small">{{ l.detail }}</td>
              </tr>
            }
          </tbody>
          <tfoot><tr><td></td><td><strong>Total delivered cost</strong></td><td class="r"><strong>{{ c().totalPerTonne | money:0 }}</strong></td><td class="r"><strong>{{ c().totalDeliveredCost | money:0 }}</strong></td><td></td></tr></tfoot>
        </table>
        @if (c().purificationSteps.length) {
          <details>
            <summary>Purification steps required ({{ c().purificationSteps.length }})</summary>
            <table class="table compact">
              <thead><tr><th>Parameter</th><th>Passport level</th><th>Your requirement</th><th class="r">Rate / t</th><th class="r">Cost</th></tr></thead>
              <tbody>@for (s of c().purificationSteps; track s.parameter) {
                <tr><td>{{ s.parameter }}</td><td>{{ s.passportLevel }}</td><td>{{ s.requiredLevel }}</td><td class="r">{{ s.ratePerTonne | money:0 }}</td><td class="r">{{ s.cost | money:0 }}</td></tr>
              }</tbody>
            </table>
          </details>
        }
      </div>
      <div class="cost-carbon">
        <h3>Carbon outcome <span class="muted small">— kept separate from price</span></h3>
        <dl class="kv">
          <dt>Gross CO₂ purchased</dt><dd>{{ c().carbon.grossTonnes | tonnes:2 }}</dd>
          <dt>Expected leakage</dt><dd>{{ c().carbon.expectedLeakagePct | number:'1.2-2' }}% → −{{ c().carbon.leakageLossTonnes | tonnes:2 }}</dd>
          <dt>Effective delivered</dt><dd>{{ c().carbon.effectiveDeliveredTonnes | tonnes:2 }}</dd>
          <dt>Transport emissions</dt><dd>−{{ c().carbon.transportEmissionsTonnes | tonnes:3 }}</dd>
          <dt class="strong">Net carbon benefit</dt><dd class="strong net">{{ c().carbon.netCarbonBenefitTonnes | tonnes:2 }} CO₂</dd>
        </dl>
        <p class="muted small">Net benefit = effective delivered − transport-caused emissions. This is the climate number; the cost stack is the commercial number.</p>
      </div>
    </div>`,
})
export class CostStackView {
  c = input.required<CostEstimateDto>();
}
