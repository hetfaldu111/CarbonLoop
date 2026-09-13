import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ImpactDto, PublicListingDto } from '../../core/models';
import { LabelPipe, MoneyPipe, TonnesPipe } from '../../shared/pipes';

interface Tick { type: string; text: string; detail: string; time: string; }

const TICKER: Tick[] = [
  { type: 'AUCTION', text: '22 t CO₂ spot auction opened', detail: 'Cement plant · Porbandar', time: 'now' },
  { type: 'TENDER', text: '80 t/day long-term tender available', detail: 'Steel producer · Angul', time: '2 min' },
  { type: 'VERIFIED', text: 'Laboratory approved CO₂-IND-2026-000342', detail: '96.8% purity certified', time: '3 min' },
  { type: 'OFFTAKE', text: '40 t/month allocated via offtake agreement', detail: 'Methanol synthesis · Dahej', time: '5 min' },
  { type: 'AUCTION', text: '50 t CO₂ spot auction cleared', detail: '₹5,300/t · Concrete curing', time: '7 min' },
  { type: 'ONBOARD', text: 'New verified emitter onboarded', detail: 'Thermal power · Mundra · MRV active', time: '9 min' },
  { type: 'VERIFIED', text: 'CO₂-IND-2026-000344 passport issued', detail: 'Industrial grade · H₂S < 0.1 ppm', time: '11 min' },
  { type: 'TENDER', text: '120 t/day multi-year tender live', detail: 'Algae cultivation · Paradip', time: '14 min' },
];

const TICK_COLOR: Record<string, string> = {
  AUCTION: '#30BE69', TENDER: '#8FBF9E', VERIFIED: '#A8E04A', OFFTAKE: '#55D084', ONBOARD: '#68876F',
};

const LIFECYCLE = [
  { label: 'CAPTURE', desc: 'Industrial CO₂ is captured at point-source — cement plants, steel mills, refineries, or biogas facilities — using scrubbing or membrane technology.' },
  { label: 'VERIFY', desc: 'Independent laboratory analysis confirms purity, impurity profile (H₂S, NOx, water content), and provenance. MRV monitoring is activated.' },
  { label: 'PASSPORT', desc: 'A unique Carbon Passport is issued: a verified digital identity containing purity specs, quantity, location, MRV status, and emitter credentials.' },
  { label: 'MATCH', desc: 'The matching engine identifies compatible utilizers from published rules — purity requirements, logistics proximity, volume and contract preferences.' },
  { label: 'TRADE', desc: 'The transaction completes via Spot Auction, Long-Term Tender, or Direct Negotiation. The Carbon Passport transfers to the utilizer.' },
  { label: 'TRANSPORT', desc: 'Logistics are coordinated — pipeline, truck, or rail. The batch is tracked from emitter to utilizer gate with chain-of-custody verification.' },
  { label: 'UTILIZE', desc: 'The utilizer applies the CO₂ industrially: concrete curing, greenhouse agriculture, chemical synthesis, or dry ice production.' },
  { label: 'PRODUCT', desc: 'The industrial product embeds or displaces CO₂. A utilization certificate is issued, completing the circular loop and enabling outcome reporting.' },
];

const INDUSTRIES = [
  { emitter: true, name: 'Cement & Lime', spec: '96–99% purity typical' },
  { emitter: true, name: 'Steel & Iron', spec: 'High CO · conditioning required' },
  { emitter: true, name: 'Thermal Power', spec: 'Amine capture · pipeline ready' },
  { emitter: true, name: 'Refineries & Chemicals', spec: 'Very high purity possible' },
  { emitter: false, name: 'Greenhouses', spec: 'Food-grade required' },
  { emitter: false, name: 'Concrete Curing', spec: 'Industrial grade sufficient' },
  { emitter: false, name: 'Fuel & Chemical Synthesis', spec: 'Specification-critical' },
  { emitter: false, name: 'Algae & Dry Ice', spec: 'Food-grade · H₂S < 0.1 ppm' },
];

@Component({
  selector: 'app-landing',
  imports: [RouterLink, DatePipe, DecimalPipe, LabelPipe, MoneyPipe, TonnesPipe],
  template: `
<div class="cl">

  <!-- ═══════════ HERO ═══════════ -->
  <section class="cl-hero" id="exchange">
    <div class="cl-hero-left">
      <div class="cl-badge">
        <span class="cl-dot"></span>
        <span class="t">PLATFORM DEMO · LIVE STATISTICS</span>
      </div>

      <h1 class="cl-h1">Turn <em>Captured Carbon</em> Into Industrial Value.</h1>

      <p class="cl-lede">A verified industrial marketplace where captured CO₂ finds its next use — matched, traded, transported, and transformed.</p>

      <div class="cl-ctas">
        <a class="cl-btn-solid" routerLink="/register">
          Explore Carbon Exchange
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M 3,8 L 13,8 M 9,4 L 13,8 L 9,12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        </a>
        <a class="cl-btn-out" href="#mechanisms">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" /><polygon points="6,5 12,8 6,11" fill="currentColor" /></svg>
          See How It Works
        </a>
      </div>

      <div class="cl-stats">
        <div class="cl-stat">
          <div class="v"><span class="n">{{ c1() | number:'1.0-0' }}</span><span class="s">&nbsp;t</span></div>
          <div class="l">CO₂ Listed</div>
        </div>
        <div class="cl-stat">
          <div class="v"><span class="n">{{ c2() | number:'1.0-0' }}</span><span class="s">&nbsp;t</span></div>
          <div class="l">CO₂ Routed for Reuse</div>
        </div>
        <div class="cl-stat">
          <div class="v"><span class="n">{{ c3() | number:'1.0-0' }}</span></div>
          <div class="l">Verified Industries</div>
        </div>
        <div class="cl-stat">
          <div class="v"><span class="n">{{ (c4() / 10) | number:'1.1-1' }}</span><span class="s">%</span></div>
          <div class="l">Successful Fulfilment</div>
        </div>
      </div>
    </div>

    <div class="cl-hero-right">
      <div class="cl-hero-glow"></div>
      <div class="cl-doodle" style="top:-20px;right:20px;opacity:.4;animation:float 4s ease infinite">
        <svg width="64" height="25" viewBox="0 0 72 28" fill="none"><circle cx="8" cy="14" r="7" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="8" cy="14" r="3" fill="#1A3C2A" fill-opacity=".15"/><line x1="15" y1="11" x2="21" y2="11" stroke="#1A3C2A" stroke-width="1.5"/><line x1="15" y1="17" x2="21" y2="17" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="36" cy="14" r="11" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="36" cy="14" r="4" fill="#1A3C2A" fill-opacity=".12"/><line x1="47" y1="11" x2="53" y2="11" stroke="#1A3C2A" stroke-width="1.5"/><line x1="47" y1="17" x2="53" y2="17" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="64" cy="14" r="7" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="64" cy="14" r="3" fill="#1A3C2A" fill-opacity=".15"/></svg>
      </div>
      <div class="cl-doodle" style="bottom:20px;left:-20px;opacity:.35;animation:float 5s ease 1s infinite">
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none"><path d="M 20,36 C 20,36 4,28 4,14 C 4,6 12,4 20,6 C 28,4 36,6 36,14 C 36,28 20,36 20,36 Z" stroke="#30BE69" stroke-width="1.5" fill="#30BE69" fill-opacity=".1"/><line x1="20" y1="36" x2="20" y2="8" stroke="#30BE69" stroke-width="1" stroke-dasharray="2,2"/><line x1="20" y1="18" x2="10" y2="12" stroke="#30BE69" stroke-width="1"/><line x1="20" y1="23" x2="30" y2="16" stroke="#30BE69" stroke-width="1"/></svg>
      </div>
      <div class="cl-doodle" style="top:30px;left:-30px;opacity:.25;animation:float 6s ease 2s infinite">
        <svg width="38" height="41" viewBox="0 0 44 48" fill="none"><path d="M 14,4 L 14,24 L 4,40 Q 2,44 6,44 L 38,44 Q 42,44 40,40 L 30,24 L 30,4 Z" stroke="#1A3C2A" stroke-width="1.5" fill="#1A3C2A" fill-opacity=".06"/><line x1="12" y1="4" x2="32" y2="4" stroke="#1A3C2A" stroke-width="1.5"/><circle cx="12" cy="36" r="3" fill="#1A3C2A" fill-opacity=".3"/><circle cx="22" cy="32" r="2" fill="#1A3C2A" fill-opacity=".2"/><circle cx="30" cy="38" r="2.5" fill="#1A3C2A" fill-opacity=".25"/></svg>
      </div>

      <div class="cl-flow-card">
        <div class="cl-flow-head"><span class="cl-dot" style="width:6px;height:6px"></span> CARBON FLOW · LIVE ROUTING</div>
        <svg viewBox="0 0 420 280" fill="none" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
          @for (y of [60,130,200,270]; track y) {<line [attr.x1]="20" [attr.y1]="y" [attr.x2]="400" [attr.y2]="y" stroke="#BECDC5" stroke-width=".5" stroke-dasharray="3,6" opacity=".5" />}
          @for (x of [60,130,200,270,340]; track x) {<line [attr.x1]="x" [attr.y1]="30" [attr.x2]="x" [attr.y2]="250" stroke="#BECDC5" stroke-width=".5" stroke-dasharray="3,6" opacity=".5" />}
          <defs>
            <path id="heroflow" d="M 60,70 C 100,70 140,70 200,70 C 260,70 300,70 340,70 L 340,190 C 300,190 260,190 200,190 L 60,190 C 60,190 60,190 60,150 C 60,130 60,100 60,70" />
          </defs>
          <line x1="80" y1="70" x2="178" y2="70" stroke="#BDD3C5" stroke-width="1.5" stroke-dasharray="4,3" /><polygon points="176,66 184,70 176,74" fill="#30BE69" />
          <line x1="222" y1="70" x2="318" y2="70" stroke="#BDD3C5" stroke-width="1.5" stroke-dasharray="4,3" /><polygon points="316,66 324,70 316,74" fill="#30BE69" />
          <line x1="340" y1="92" x2="340" y2="168" stroke="#BDD3C5" stroke-width="1.5" stroke-dasharray="4,3" /><polygon points="336,166 340,174 344,166" fill="#30BE69" />
          <line x1="318" y1="190" x2="222" y2="190" stroke="#BDD3C5" stroke-width="1.5" stroke-dasharray="4,3" /><polygon points="224,186 216,190 224,194" fill="#30BE69" />
          <line x1="178" y1="190" x2="82" y2="190" stroke="#BDD3C5" stroke-width="1.5" stroke-dasharray="4,3" /><polygon points="84,186 76,190 84,194" fill="#30BE69" />
          <path d="M 60,170 C 60,140 40,120 40,80 C 40,60 50,50 60,50 C 75,50 80,60 80,70" stroke="#30BE69" stroke-width="1.5" stroke-dasharray="3,3" fill="none" opacity=".6" /><polygon points="56,68 60,76 64,68" fill="#30BE69" opacity=".6" />
          @for (d of particleDelays; track d) {
            <g>
              <circle r="5" fill="#30BE69" fill-opacity=".85"><animateMotion dur="6s" repeatCount="indefinite" [attr.begin]="d + 's'"><mpath href="#heroflow" /></animateMotion></circle>
              <circle r="8" fill="#30BE69" fill-opacity=".2"><animateMotion dur="6s" repeatCount="indefinite" [attr.begin]="d + 's'"><mpath href="#heroflow" /></animateMotion></circle>
            </g>
          }
          <!-- Stage discs -->
          @for (s of stages; track s.label) {<circle [attr.cx]="s.x" [attr.cy]="s.y" r="26" fill="white" stroke="#C4DCCC" stroke-width="1.5" />}
          <!-- Factory -->
          <g transform="translate(42,52)"><rect x="2" y="18" width="32" height="14" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><rect x="6" y="8" width="7" height="10" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><rect x="16" y="12" width="5" height="6" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><circle cx="9.5" cy="5" r="2.5" stroke="#30BE69" stroke-width="1" fill="none" opacity=".7"/><circle cx="13" cy="2" r="1.5" stroke="#30BE69" stroke-width="1" fill="none" opacity=".4"/></g>
          <!-- Capture -->
          <g transform="translate(182,52)"><rect x="8" y="4" width="20" height="28" rx="10" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><line x1="18" y1="4" x2="18" y2="32" stroke="#1A3C2A" stroke-width="1" stroke-dasharray="2,2" opacity=".4"/><text x="18" y="22" text-anchor="middle" font-size="7" fill="#1A3C2A" font-family="JetBrains Mono, monospace" font-weight="500">CO₂</text><line x1="28" y1="18" x2="34" y2="18" stroke="#30BE69" stroke-width="1.5"/><line x1="2" y1="18" x2="8" y2="18" stroke="#30BE69" stroke-width="1.5"/></g>
          <!-- Passport -->
          <g transform="translate(322,52)"><rect x="4" y="4" width="28" height="28" rx="3" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><rect x="8" y="8" width="20" height="8" rx="1" fill="#30BE69" fill-opacity=".25" stroke="#30BE69" stroke-width="1"/><line x1="8" y1="20" x2="20" y2="20" stroke="#1A3C2A" stroke-width="1" opacity=".5"/><line x1="8" y1="24" x2="16" y2="24" stroke="#1A3C2A" stroke-width="1" opacity=".3"/><circle cx="26" cy="26" r="4" fill="#A8E04A" fill-opacity=".6" stroke="#1A3C2A" stroke-width="1"/><path d="M 23.5,26 L 25.5,28 L 28.5,24" stroke="#1A3C2A" stroke-width="1" stroke-linecap="round"/></g>
          <!-- Truck -->
          <g transform="translate(322,172)"><rect x="2" y="14" width="22" height="14" rx="2" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><path d="M 24,20 L 30,20 L 34,26 L 34,28 L 24,28 Z" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><circle cx="8" cy="29" r="3" stroke="#1A3C2A" stroke-width="1.5" fill="white"/><circle cx="22" cy="29" r="3" stroke="#1A3C2A" stroke-width="1.5" fill="white"/><circle cx="31" cy="29" r="3" stroke="#1A3C2A" stroke-width="1.5" fill="white"/><line x1="2" y1="20" x2="24" y2="20" stroke="#1A3C2A" stroke-width="1" opacity=".3"/></g>
          <!-- Utilizer plant -->
          <g transform="translate(182,172)"><rect x="4" y="18" width="28" height="14" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><rect x="14" y="8" width="8" height="10" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><rect x="7" y="12" width="5" height="6" rx="1" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><circle cx="18" cy="5" r="2" stroke="#30BE69" stroke-width="1" fill="none" opacity=".6"/><line x1="4" y1="24" x2="32" y2="24" stroke="#1A3C2A" stroke-width=".75" opacity=".3"/></g>
          <!-- Product -->
          <g transform="translate(42,172)"><rect x="6" y="10" width="24" height="22" rx="2" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7"/><line x1="6" y1="18" x2="30" y2="18" stroke="#1A3C2A" stroke-width="1" opacity=".4"/><line x1="18" y1="10" x2="18" y2="32" stroke="#1A3C2A" stroke-width="1" opacity=".4"/><path d="M 6,10 L 10,6 L 34,6 L 30,10" stroke="#1A3C2A" stroke-width="1.5" fill="#C4DCCC"/><path d="M 30,10 L 34,6 L 34,28 L 30,32" stroke="#1A3C2A" stroke-width="1.5" fill="#BECDC5"/><circle cx="24" cy="22" r="2.5" fill="#A8E04A" fill-opacity=".7"/></g>
          @for (s of stages; track s.label) {
            <text [attr.x]="s.x" [attr.y]="s.y < 130 ? s.y + 40 : s.y - 34" text-anchor="middle" font-size="9" fill="#1A3C2A" font-family="JetBrains Mono, monospace" font-weight="500" letter-spacing=".5">{{ s.label }}</text>
          }
          <text x="140" y="60" text-anchor="middle" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace" opacity=".9">CO₂</text>
          <text x="280" y="60" text-anchor="middle" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace" opacity=".9">VERIFIED</text>
          <text x="355" y="135" text-anchor="start" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace" opacity=".9">GAS</text>
          <text x="260" y="205" text-anchor="middle" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace" opacity=".9">ROUTED</text>
          <text x="130" y="205" text-anchor="middle" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace" opacity=".9">USED</text>
          <g opacity=".3" transform="translate(380,40)"><circle cx="0" cy="8" r="5" stroke="#1A3C2A" stroke-width="1"/><line x1="5" y1="6" x2="10" y2="6" stroke="#1A3C2A" stroke-width="1"/><line x1="5" y1="10" x2="10" y2="10" stroke="#1A3C2A" stroke-width="1"/><circle cx="15" cy="8" r="7" stroke="#1A3C2A" stroke-width="1"/><line x1="22" y1="6" x2="27" y2="6" stroke="#1A3C2A" stroke-width="1"/><line x1="22" y1="10" x2="27" y2="10" stroke="#1A3C2A" stroke-width="1"/><circle cx="32" cy="8" r="5" stroke="#1A3C2A" stroke-width="1"/></g>
          <g opacity=".25" transform="translate(10,220)"><circle cx="0" cy="8" r="4" stroke="#30BE69" stroke-width="1"/><line x1="4" y1="6" x2="8" y2="6" stroke="#30BE69" stroke-width="1"/><line x1="4" y1="10" x2="8" y2="10" stroke="#30BE69" stroke-width="1"/><circle cx="13" cy="8" r="6" stroke="#30BE69" stroke-width="1"/><line x1="19" y1="6" x2="23" y2="6" stroke="#30BE69" stroke-width="1"/><line x1="19" y1="10" x2="23" y2="10" stroke="#30BE69" stroke-width="1"/><circle cx="28" cy="8" r="4" stroke="#30BE69" stroke-width="1"/></g>
        </svg>
      </div>
    </div>
  </section>

  <!-- ═══════════ TICKER ═══════════ -->
  <div class="cl-ticker">
    <div class="cl-ticker-live"><span class="cl-dot" style="width:6px;height:6px"></span><span class="lbl">LIVE</span></div>
    <div class="cl-ticker-track">
      @for (t of tickerDoubled; track $index) {
        <div class="cl-tick">
          <span class="tag" [style.background]="tickColor(t.type) + '22'" [style.color]="tickColor(t.type)" [style.border-color]="tickColor(t.type) + '44'">{{ t.type }}</span>
          <span class="txt">{{ t.text }}</span>
          <span class="sep">·</span>
          <span class="det">{{ t.detail }}</span>
          <span class="ago">{{ t.time }} ago</span>
          <span class="dash">——</span>
        </div>
      }
    </div>
    <div class="cl-ticker-fade"></div>
  </div>

  <!-- ═══════════ MECHANISMS ═══════════ -->
  <section class="cl-section" id="mechanisms">
    <div class="cl-section-head">
      <div class="cl-eyebrow">Trading Infrastructure</div>
      <h2 class="cl-h2" style="max-width:520px">Three Ways to Trade Industrial CO₂</h2>
      <div class="cl-head-row">
        <div class="cl-fact">
          <svg width="40" height="16" viewBox="0 0 72 28" fill="none" style="opacity:.7;flex:none;margin-top:4px"><circle cx="8" cy="14" r="7" stroke="#30BE69" stroke-width="1.5"/><line x1="15" y1="11" x2="21" y2="11" stroke="#30BE69" stroke-width="1.5"/><line x1="15" y1="17" x2="21" y2="17" stroke="#30BE69" stroke-width="1.5"/><circle cx="36" cy="14" r="11" stroke="#30BE69" stroke-width="1.5"/><line x1="47" y1="11" x2="53" y2="11" stroke="#30BE69" stroke-width="1.5"/><line x1="47" y1="17" x2="53" y2="17" stroke="#30BE69" stroke-width="1.5"/><circle cx="64" cy="14" r="7" stroke="#30BE69" stroke-width="1.5"/></svg>
          <p>“CO₂ ≠ CO₂ — industrial applications require different purity and impurity specifications.”</p>
        </div>
      </div>
    </div>

    <div class="cl-mechs">
      <!-- 01 Spot Auction -->
      <div class="cl-mech a1">
        <div class="cl-mech-art">
          <svg viewBox="0 0 200 160" fill="none" width="100%" style="max-height:160px">
            <circle cx="60" cy="80" r="45" stroke="#1A3C2A" stroke-width="1.5" fill="#E2F0E7" fill-opacity=".4"/>
            <circle cx="60" cy="80" r="2.5" fill="#1A3C2A"/>
            <line x1="60" y1="80" x2="60" y2="46" stroke="#1A3C2A" stroke-width="2" stroke-linecap="round"/>
            <line x1="60" y1="80" x2="84" y2="90" stroke="#30BE69" stroke-width="2" stroke-linecap="round"/>
            @for (m of clockMarks; track m.deg) {<line [attr.x1]="m.x1" [attr.y1]="m.y1" [attr.x2]="m.x2" [attr.y2]="m.y2" stroke="#1A3C2A" [attr.stroke-width]="m.w" />}
            @for (b of bidBars; track b.x) {
              <g><rect [attr.x]="b.x - 8" [attr.y]="b.y - b.h" width="16" [attr.height]="b.h" rx="2" [attr.fill]="b.c" fill-opacity=".25" [attr.stroke]="b.c" stroke-width="1"/>
              <polygon [attr.points]="b.x + ',' + (b.y - b.h - 8) + ' ' + (b.x - 7) + ',' + (b.y - b.h) + ' ' + (b.x + 7) + ',' + (b.y - b.h)" [attr.fill]="b.c"/></g>
            }
            <line x1="118" y1="155" x2="200" y2="155" stroke="#BECDC5" stroke-width="1"/>
            <text x="158" y="168" text-anchor="middle" font-size="9" fill="#68876F" font-family="JetBrains Mono, monospace">COMPETITIVE BID</text>
          </svg>
        </div>
        <div class="cl-mech-body">
          <div class="cl-mech-top"><span class="cl-mech-tag" style="color:#30BE69;border-color:#30BE6944">SHORT-TERM</span><span class="cl-mech-num">01</span></div>
          <h3>Spot Auction</h3>
          <p>For short-term available CO₂. Competitive bidding from compatible utilizers, with a fixed increment and a binding last bid.</p>
          <div class="cl-mech-list">
            <div><i style="background:#30BE69"></i><span>Live ascending bids</span></div>
            <div><i style="background:#30BE69"></i><span>Purity-verified batches</span></div>
            <div><i style="background:#30BE69"></i><span>Carbon Passport issued on award</span></div>
          </div>
        </div>
      </div>

      <!-- 02 Long-Term Tender -->
      <div class="cl-mech a2">
        <div class="cl-mech-art">
          <svg viewBox="0 0 200 160" fill="none" width="100%" style="max-height:160px">
            <line x1="20" y1="80" x2="180" y2="80" stroke="#BECDC5" stroke-width="1.5"/>
            @for (t of timelineDots; track t.x) {
              <g>
                @if (t.i > 0) {<line [attr.x1]="t.x - 40" y1="80" [attr.x2]="t.x" y2="80" [attr.stroke]="t.i < 3 ? '#30BE69' : '#BECDC5'" stroke-width="2" [attr.stroke-dasharray]="t.i >= 3 ? '3,3' : ''"/>}
                <circle [attr.cx]="t.x" cy="80" [attr.r]="t.i === 0 ? 5 : 4" [attr.fill]="t.i === 0 ? '#30BE69' : (t.i < 3 ? '#A8E04A' : '#BECDC5')"/>
                <text [attr.x]="t.x" y="100" text-anchor="middle" font-size="7.5" fill="#68876F" font-family="JetBrains Mono, monospace">{{ t.label }}</text>
              </g>
            }
            <rect x="70" y="18" width="60" height="50" rx="3" fill="white" stroke="#C4DCCC" stroke-width="1.5"/>
            <rect x="75" y="24" width="50" height="8" rx="1" fill="#30BE69" fill-opacity=".3" stroke="#30BE69" stroke-width=".75"/>
            <line x1="75" y1="38" x2="120" y2="38" stroke="#BECDC5" stroke-width="1"/><line x1="75" y1="44" x2="110" y2="44" stroke="#BECDC5" stroke-width="1"/>
            <line x1="75" y1="50" x2="115" y2="50" stroke="#BECDC5" stroke-width="1"/><line x1="75" y1="56" x2="100" y2="56" stroke="#BECDC5" stroke-width="1"/>
            <circle cx="118" cy="60" r="7" fill="#A8E04A" fill-opacity=".6" stroke="#1A3C2A" stroke-width="1"/>
            <path d="M 115,60 L 117,62 L 121,57" stroke="#1A3C2A" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="cl-mech-body">
          <div class="cl-mech-top"><span class="cl-mech-tag" style="color:#1A3C2A;border-color:#1A3C2A44">RECURRING</span><span class="cl-mech-num">02</span></div>
          <h3>Long-Term Tender</h3>
          <p>For recurring CO₂ production. Six-month, twelve-month or multi-year industrial offtake agreements, awarded to one buyer or several.</p>
          <div class="cl-mech-list">
            <div><i style="background:#1A3C2A"></i><span>Volume commitment contracts</span></div>
            <div><i style="background:#1A3C2A"></i><span>Split awards across buyers</span></div>
            <div><i style="background:#1A3C2A"></i><span>MRV reporting included</span></div>
          </div>
        </div>
      </div>

      <!-- 03 Direct Negotiation -->
      <div class="cl-mech a3">
        <div class="cl-mech-art">
          <svg viewBox="0 0 200 160" fill="none" width="100%" style="max-height:160px">
            <circle cx="40" cy="80" r="28" fill="#E2F0E7" stroke="#1A3C2A" stroke-width="1.5"/>
            <circle cx="160" cy="80" r="28" fill="#E2F0E7" stroke="#1A3C2A" stroke-width="1.5"/>
            <g transform="translate(25,65)"><rect x="2" y="8" width="26" height="14" rx="1" stroke="#1A3C2A" stroke-width="1.3" fill="white"/><rect x="6" y="2" width="7" height="8" rx="1" stroke="#1A3C2A" stroke-width="1.3" fill="white"/></g>
            <g transform="translate(145,65)"><rect x="2" y="8" width="26" height="14" rx="1" stroke="#30BE69" stroke-width="1.3" fill="white"/><rect x="16" y="2" width="7" height="8" rx="1" stroke="#30BE69" stroke-width="1.3" fill="white"/></g>
            <line x1="68" y1="76" x2="132" y2="76" stroke="#30BE69" stroke-width="2" stroke-dasharray="5,3"/>
            <line x1="68" y1="84" x2="132" y2="84" stroke="#30BE69" stroke-width="2" stroke-dasharray="5,3"/>
            <polygon points="130,72 138,80 130,88" fill="#30BE69"/><polygon points="70,72 62,80 70,88" fill="#A8E04A"/>
            <text x="40" y="124" text-anchor="middle" font-size="8.5" fill="#68876F" font-family="JetBrains Mono, monospace">EMITTER</text>
            <text x="160" y="124" text-anchor="middle" font-size="8.5" fill="#68876F" font-family="JetBrains Mono, monospace">UTILIZER</text>
            <text x="100" y="65" text-anchor="middle" font-size="8" fill="#30BE69" font-family="JetBrains Mono, monospace">PRIVATE</text>
            <rect x="90" y="80" width="20" height="16" rx="2" fill="white" stroke="#1A3C2A" stroke-width="1"/>
            <path d="M 94,80 C 94,73 106,73 106,80" stroke="#1A3C2A" stroke-width="1.5" fill="none"/>
            <circle cx="100" cy="89" r="2" fill="#30BE69"/>
          </svg>
        </div>
        <div class="cl-mech-body">
          <div class="cl-mech-top"><span class="cl-mech-tag" style="color:#5C7A18;border-color:#A8E04A88">BILATERAL</span><span class="cl-mech-num">03</span></div>
          <h3>Direct Negotiation</h3>
          <p>For companies that already know their preferred trading partner. A private offer thread, without an auction.</p>
          <div class="cl-mech-list">
            <div><i style="background:#A8E04A"></i><span>Private channel</span></div>
            <div><i style="background:#A8E04A"></i><span>Custom terms &amp; versioned offers</span></div>
            <div><i style="background:#A8E04A"></i><span>Platform verification &amp; Passport issuance</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════ LIFECYCLE ═══════════ -->
  <section class="cl-dark" id="verify">
    <div class="cl-doodle" style="top:60px;left:40px;opacity:.08">
      <svg width="120" height="32" viewBox="0 0 120 32" fill="none"><rect x="4" y="10" width="112" height="12" rx="6" stroke="#30BE69" stroke-width="1.5" fill="#30BE69" fill-opacity=".06"/><circle cx="22" cy="16" r="4" stroke="#30BE69" stroke-width="1"/><circle cx="60" cy="16" r="4" stroke="#30BE69" stroke-width="1"/><circle cx="98" cy="16" r="4" stroke="#30BE69" stroke-width="1"/></svg>
    </div>
    <div class="cl-doodle" style="bottom:60px;right:60px;opacity:.08">
      <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><path d="M 10,30 C 10,10 70,10 70,30 C 70,50 10,50 10,30" stroke="#30BE69" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/><polygon points="10,22 4,32 16,32" fill="#30BE69"/></svg>
    </div>

    <div class="cl-wrap">
      <div class="cl-section-head">
        <div class="cl-eyebrow">Circular Economy Engine</div>
        <h2 class="cl-h2">The Carbon Lifecycle</h2>
      </div>

      <div class="cl-life">
        <div>
          <svg viewBox="0 0 400 400" width="100%" fill="none">
            <circle cx="200" cy="200" r="158" stroke="#1A3C2A" stroke-width="1" stroke-dasharray="3,6" opacity=".5"/>
            <circle cx="200" cy="200" r="122" stroke="#1A3C2A" stroke-width=".75" stroke-dasharray="2,8" opacity=".3"/>
            <circle cx="200" cy="200" r="140" stroke="#1A3C2A" stroke-width="2"/>
            <path [attr.d]="activeArc()" stroke="#30BE69" stroke-width="4" stroke-linecap="round" />
            <circle cx="200" cy="200" r="38" fill="#1A3C2A" stroke="#30BE69" stroke-width="1" stroke-opacity=".5"/>
            <text x="200" y="192" text-anchor="middle" font-size="9" fill="#30BE69" font-family="JetBrains Mono, monospace" letter-spacing="1">CARBON</text>
            <text x="200" y="206" text-anchor="middle" font-size="9" fill="#30BE69" font-family="JetBrains Mono, monospace" letter-spacing="1">LOOP</text>
            <circle cx="200" cy="200" r="10" fill="#30BE69" fill-opacity=".2"><animate attributeName="r" values="10;16;10" dur="3s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.2;0.05;0.2" dur="3s" repeatCount="indefinite"/></circle>
            @for (n of nodes; track n.i) {
              <g class="cl-node" (click)="active.set(n.i)">
                @if (n.i === active()) {<circle [attr.cx]="n.x" [attr.cy]="n.y" r="30" fill="#30BE69" fill-opacity=".1"><animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.12;0.02;0.12" dur="2s" repeatCount="indefinite"/></circle>}
                <circle [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="n.i === active() ? 22 : 18" [attr.fill]="n.i === active() ? '#30BE69' : '#1A3C2A'" [attr.stroke]="n.i === active() ? '#A8E04A' : '#2C5E40'" [attr.stroke-width]="n.i === active() ? 2 : 1.5" style="transition:all .3s ease"/>
                <text [attr.x]="n.x" [attr.y]="n.y + 1" text-anchor="middle" dominant-baseline="middle" font-size="6.5" [attr.fill]="n.i === active() ? '#0C1E12' : '#68876F'" font-family="JetBrains Mono, monospace" font-weight="500">{{ n.num }}</text>
                <text [attr.x]="n.lx" [attr.y]="n.ly" text-anchor="middle" dominant-baseline="middle" font-size="7.5" [attr.fill]="n.i === active() ? '#30BE69' : '#3A5A42'" font-family="JetBrains Mono, monospace" letter-spacing=".5">{{ n.label }}</text>
              </g>
            }
          </svg>
        </div>

        <div>
          <div class="cl-life-step">STEP {{ stepNum() }} / 08</div>
          <h3>{{ steps[active()].label }}</h3>
          <p>{{ steps[active()].desc }}</p>
          <div class="cl-life-dots">
            @for (n of nodes; track n.i) {<button [class.on]="n.i === active()" (click)="active.set(n.i)" [attr.aria-label]="'Step ' + n.num"></button>}
          </div>
          <div class="cl-life-fact">
            <div class="cl-fact on-dark">
              <svg width="28" height="30" viewBox="0 0 44 48" fill="none" style="flex:none"><path d="M 14,4 L 14,24 L 4,40 Q 2,44 6,44 L 38,44 Q 42,44 40,40 L 30,24 L 30,4 Z" stroke="#30BE69" stroke-width="1.5" fill="#30BE69" fill-opacity=".06"/><line x1="12" y1="4" x2="32" y2="4" stroke="#30BE69" stroke-width="1.5"/></svg>
              <p>“The closest buyer is not always the cheapest buyer once conditioning and transport are included.”</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════ PASSPORT ═══════════ -->
  <section class="cl-section">
    <div class="cl-pass">
      <div class="cl-pass-wrap">
        <div class="cl-pass-card">
          <div class="cl-pass-head">
            <div><div class="k">CARBON PASSPORT</div><div class="n">CarbonLoop</div></div>
            <div style="text-align:right"><div class="idk">PASSPORT ID</div><div class="idv">CO₂-IND-342</div></div>
          </div>
          <div class="cl-pass-status"><span class="cl-dot"></span> VERIFIED · AVAILABLE FOR TRADE</div>
          <div class="cl-pass-body">
            <div class="cl-pass-grid">
              <div class="cl-fld"><div class="k">EMITTER</div><div class="v">Saurashtra Cement Works</div></div>
              <div class="cl-fld"><div class="k">LOCATION</div><div class="v">Porbandar, Gujarat</div></div>
              <div class="cl-fld"><div class="k">CO₂ PURITY</div><div class="v acc">96.8%</div></div>
              <div class="cl-fld"><div class="k">QUANTITY</div><div class="v acc">22 t / day</div></div>
              <div class="cl-fld"><div class="k">STATE</div><div class="v">Liquefied · 18 bar</div></div>
              <div class="cl-fld"><div class="k">H₂S LEVEL</div><div class="v acc">&lt; 0.05 ppm</div></div>
              <div class="cl-fld"><div class="k">LAB VERIFY</div><div class="v">National CO₂ Testing Lab</div></div>
              <div class="cl-fld"><div class="k">MRV STATUS</div><div class="v">Active · ISO 14064</div></div>
            </div>
            <div class="cl-pass-foot">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style="flex:none">
                <rect width="52" height="52" rx="4" fill="#F8FCF8" stroke="#C4DCCC" stroke-width="1"/>
                <rect x="6" y="6" width="16" height="16" rx="2" stroke="#1A3C2A" stroke-width="1.5"/><rect x="9" y="9" width="10" height="10" fill="#1A3C2A" opacity=".15"/>
                <rect x="30" y="6" width="16" height="16" rx="2" stroke="#1A3C2A" stroke-width="1.5"/><rect x="33" y="9" width="10" height="10" fill="#1A3C2A" opacity=".15"/>
                <rect x="6" y="30" width="16" height="16" rx="2" stroke="#1A3C2A" stroke-width="1.5"/><rect x="9" y="33" width="10" height="10" fill="#1A3C2A" opacity=".15"/>
                <rect x="30" y="30" width="4" height="4" fill="#30BE69"/><rect x="36" y="30" width="4" height="4" fill="#30BE69"/><rect x="42" y="30" width="4" height="4" fill="#30BE69"/>
                <rect x="30" y="36" width="4" height="4" fill="#30BE69"/><rect x="42" y="36" width="4" height="4" fill="#30BE69"/>
                <rect x="30" y="42" width="10" height="4" fill="#30BE69"/><rect x="42" y="42" width="4" height="4" fill="#30BE69"/>
              </svg>
              <div>
                <div class="cl-coc">CHAIN OF CUSTODY</div>
                <div class="cl-coc-tags"><span>CAPTURED</span><span>VERIFIED</span><span>LISTED</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="cl-eyebrow">Digital Verification</div>
        <h2 class="cl-h2" style="margin-bottom:1.5rem">Every Tonne Gets a<br /><em>Carbon Passport.</em></h2>
        <p style="font-size:1rem;color:var(--muted-2);line-height:1.75;margin-bottom:2rem">
          Before any CO₂ changes hands, it receives a unique verified digital identity. The Carbon Passport encodes purity specifications, provenance, MRV status, lab certifications, and quantity — ensuring every buyer knows exactly what they are receiving.
        </p>
        @for (f of passportFeatures; track f.label) {
          <div class="cl-check">
            <div class="ic"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M 2,6 L 5,9 L 10,3" stroke="#30BE69" stroke-width="1.5" stroke-linecap="round"/></svg></div>
            <div><div class="lb">{{ f.label }}</div><div class="ds">{{ f.desc }}</div></div>
          </div>
        }
        <div style="margin-top:2rem">
          <div class="cl-fact">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" style="flex:none"><path d="M 20,36 C 20,36 4,28 4,14 C 4,6 12,4 20,6 C 28,4 36,6 36,14 C 36,28 20,36 20,36 Z" stroke="#30BE69" stroke-width="1.5" fill="#30BE69" fill-opacity=".1"/><line x1="20" y1="36" x2="20" y2="8" stroke="#30BE69" stroke-width="1" stroke-dasharray="2,2"/></svg>
            <p>“Captured CO₂ does not automatically equal a carbon credit. A Carbon Passport tracks industrial utilization, not atmospheric offset.”</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════ LIVE SUPPLY ═══════════ -->
  @if (listings().length) {
    <section class="cl-supply">
      <div class="cl-wrap">
        <div style="margin-bottom:2.5rem">
          <div class="cl-eyebrow">Open Right Now</div>
          <h2 class="cl-h2">Live CO₂ Supply</h2>
          <p style="font-size:1rem;color:var(--muted-2);line-height:1.75;margin-top:1rem;max-width:560px">
            Company identities stay hidden until two parties are inside an active deal. Sign in to respond to any lot.
          </p>
        </div>
        <div class="cl-lots">
          @for (l of listings(); track l.id) {
            <div class="cl-lot">
              <div class="top">
                <span class="cl-mech-tag" [style.color]="l.mode === 'AUCTION' ? '#14804A' : '#1A3C2A'" [style.border-color]="l.mode === 'AUCTION' ? '#14804A44' : '#1A3C2A44'">{{ l.mode | label }}</span>
                <span style="font-family:var(--mono);font-size:.68rem;color:var(--muted)">closes {{ l.closesAt | date:'MMM d' }}</span>
              </div>
              <div class="price">{{ l.basePricePerTonne | money:0 }}<small>&nbsp;/t</small></div>
              <dl>
                <dt>Volume</dt><dd>{{ l.volumeTonnes | tonnes }}</dd>
                <dt>Purity</dt><dd>{{ l.concentrationPct }}% CO₂</dd>
                <dt>State</dt><dd>{{ l.physicalState | label }}</dd>
                <dt>Region</dt><dd>{{ l.city }}, {{ l.state }}</dd>
              </dl>
              <a class="btn btn-sm" routerLink="/login" style="margin-top:1rem;width:100%">Log in to respond</a>
            </div>
          }
        </div>
      </div>
    </section>
  }

  <!-- ═══════════ INDUSTRIES ═══════════ -->
  <section class="cl-supply" style="background:var(--bg);border-top:none" id="about">
    <div class="cl-wrap">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4rem;margin-bottom:3rem" class="cl-pass">
        <div>
          <div class="cl-eyebrow">Verified Network</div>
          <h2 class="cl-h2">Both Sides of the<br />Circular Economy</h2>
        </div>
        <div style="display:flex;align-items:flex-end;padding-bottom:.5rem">
          <p style="font-size:1rem;color:var(--muted-2);line-height:1.75;margin:0">
            From heavy-emitting industries that must decarbonise, to high-value utilizers that need specification-grade CO₂ — CarbonLoop connects both sides, with every tonne locked to a single buyer inside a database transaction.
          </p>
        </div>
      </div>
      <div class="cl-inds">
        @for (i of industries; track i.name) {
          <div class="cl-ind" [class.em]="i.emitter" [class.ut]="!i.emitter">
            <div class="role">{{ i.emitter ? 'EMITTER' : 'UTILIZER' }}</div>
            <div class="nm">{{ i.name }}</div>
            <div class="sp">{{ i.spec }}</div>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ═══════════ RULES / POLICY ═══════════ -->
  <section class="cl-section" style="padding-top:2rem">
    <div class="cl-section-head" style="margin-bottom:2.5rem">
      <h2 class="cl-h2">How Matching Works</h2>
    </div>
    <div class="cl-rules">
      <div class="cl-rule">
        <div class="n">01 · PASSPORT FIRST</div>
        <h4>Verified before listed</h4>
        <p>Every batch gets a Passport recording source, capture technology, concentration, impurities, state, pressure, meter ID and location. An independent lab issues the Certificate of Analysis before anything can be listed, and certificates expire and must be re-tested.</p>
      </div>
      <div class="cl-rule">
        <div class="n">02 · ONE CAPACITY LEDGER</div>
        <h4>The same tonne is never sold twice</h4>
        <p>An emitter splits a Passport across tender, auction and contract. Every allocated tonne is locked on the Passport inside a database transaction with a row-level lock, so concurrent buyers cannot oversell the same stock. Unawarded volume returns to free stock.</p>
      </div>
      <div class="cl-rule">
        <div class="n">03 · PUBLISHED RULES</div>
        <h4>Ranked by arithmetic, decided by people</h4>
        <p>For a tender the platform computes which combination of buyers is worth most and says so in plain language. Where offers are worth the same, the stronger earned badge wins. The emitter always makes the final call.</p>
      </div>
      <div class="cl-rule">
        <div class="n">04 · FULL DELIVERED COST</div>
        <h4>Every layer shown separately</h4>
        <p>Base price, purification when your spec exceeds the stream, transport by pipeline, rail or truck, lab verification and platform fee. Expected leakage and net carbon benefit are reported on their own, never blended into the price.</p>
      </div>
      <div class="cl-rule">
        <div class="n">05 · CHAIN OF CUSTODY</div>
        <h4>Sealed, weighed, reconciled</h4>
        <p>Tamper-evident numbered seals, signed meter readings and lab sampling at both loading and delivery. Weight, seal, purity and meter reconciliation automatically flag a shipment when anything drifts beyond tolerance.</p>
      </div>
      <div class="cl-rule">
        <div class="n">06 · POLICY GROUNDING</div>
        <h4>Built for the Indian CCUS push</h4>
        <p>India's ₹20,000 crore CCUS allocation for 2026-27 targets power, steel, cement, refineries and chemicals. NITI Aayog's cluster-hub model names Gujarat and Odisha as pilots, and the EU's CBAM entered its financial phase on 1 January 2026. The regulator view flags which companies and deals qualify.</p>
      </div>
    </div>
  </section>

  <!-- ═══════════ CTA ═══════════ -->
  <section class="cl-cta">
    <div class="cl-doodle" style="top:40px;left:10%;opacity:.07;animation:float 6s ease infinite">
      <svg width="120" height="47" viewBox="0 0 72 28" fill="none"><circle cx="8" cy="14" r="7" stroke="#30BE69" stroke-width="1.5"/><line x1="15" y1="11" x2="21" y2="11" stroke="#30BE69" stroke-width="1.5"/><line x1="15" y1="17" x2="21" y2="17" stroke="#30BE69" stroke-width="1.5"/><circle cx="36" cy="14" r="11" stroke="#30BE69" stroke-width="1.5"/><line x1="47" y1="11" x2="53" y2="11" stroke="#30BE69" stroke-width="1.5"/><line x1="47" y1="17" x2="53" y2="17" stroke="#30BE69" stroke-width="1.5"/><circle cx="64" cy="14" r="7" stroke="#30BE69" stroke-width="1.5"/></svg>
    </div>
    <div class="cl-doodle" style="bottom:40px;right:8%;opacity:.06;animation:float 8s ease 2s infinite">
      <svg width="80" height="80" viewBox="0 0 40 40" fill="none"><path d="M 20,36 C 20,36 4,28 4,14 C 4,6 12,4 20,6 C 28,4 36,6 36,14 C 36,28 20,36 20,36 Z" stroke="#A8E04A" stroke-width="1.5"/><line x1="20" y1="36" x2="20" y2="8" stroke="#A8E04A" stroke-width="1" stroke-dasharray="2,2"/></svg>
    </div>
    <div class="cl-cta-inner">
      <div class="eyebrow">· OPEN FOR PILOT PARTNERSHIPS ·</div>
      <h2>Ready to route your<br /><em>captured CO₂</em> to value?</h2>
      <p>Whether you capture tonnes of CO₂ you need to place, or you need industrial CO₂ for your process — we verify, match, and move it.</p>
      <div class="cl-cta-btns">
        <a class="cl-btn-eco" routerLink="/register">
          Register as Emitter
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M 2,7 L 12,7 M 8,3 L 12,7 L 8,11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </a>
        <a class="cl-btn-ghost" routerLink="/register">Register as Utilizer</a>
      </div>
    </div>
  </section>

  <!-- ═══════════ FOOTER ═══════════ -->
  <footer class="cl-foot">
    <div class="cl-foot-inner">
      <div class="cl-logo">
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" stroke="#1A3C2A" stroke-width="1.5"/><path d="M 14,3 A 11,11 0 1,1 3,14" stroke="#30BE69" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="14" cy="3" r="2.5" fill="#30BE69"/><polygon points="3,11 3,17 7,14" fill="#30BE69"/><circle cx="14" cy="14" r="3" fill="#30BE69" fill-opacity=".4"/></svg>
        <span class="cl-logo-text">Carbon<span>Loop</span></span>
      </div>
      <div class="meta">© 2026 CARBONLOOP · INDUSTRIAL CO₂ MARKETPLACE · HACKOUT '26 DEMO</div>
      <div class="links"><a routerLink="/login">Log in</a><a routerLink="/register">Register</a></div>
    </div>
  </footer>
</div>`,
})
export class Landing implements OnDestroy {
  private api = inject(ApiService);

  stages = [
    { x: 60, y: 70, label: 'FACTORY' }, { x: 200, y: 70, label: 'CAPTURE' }, { x: 340, y: 70, label: 'PASSPORT' },
    { x: 340, y: 190, label: 'TRANSPORT' }, { x: 200, y: 190, label: 'UTILIZER' }, { x: 60, y: 190, label: 'PRODUCT' },
  ];
  particleDelays = [0, 1.6, 3.2, 4.8];
  ticker = TICKER;
  tickerDoubled = [...TICKER, ...TICKER];
  steps = LIFECYCLE;
  industries = INDUSTRIES;
  passportFeatures = [
    { label: 'Purity Verified', desc: 'Independent laboratory analysis to buyer specifications.' },
    { label: 'MRV Activated', desc: 'ISO 14064-compliant monitoring, reporting, and verification.' },
    { label: 'Chain of Custody', desc: 'Sealed and reconciled from capture through transport to utilization.' },
    { label: 'Outcome Certificate', desc: 'Issued upon utilization — distinct from carbon credits.' },
  ];

  /** Clock face ticks for the spot-auction illustration. */
  clockMarks = Array.from({ length: 12 }, (_, i) => {
    const deg = i * 30, r = (deg * Math.PI) / 180, long = i % 3 === 0;
    return {
      deg,
      x1: 60 + 38 * Math.sin(r), y1: 80 - 38 * Math.cos(r),
      x2: 60 + (long ? 32 : 35) * Math.sin(r), y2: 80 - (long ? 32 : 35) * Math.cos(r),
      w: long ? 1.5 : 0.75,
    };
  });
  bidBars = [
    { x: 130, y: 130, h: 60, c: '#30BE69' }, { x: 150, y: 140, h: 40, c: '#A8E04A' },
    { x: 170, y: 120, h: 80, c: '#30BE69' }, { x: 190, y: 150, h: 30, c: '#C4DCCC' },
  ];
  timelineDots = ['NOW', '6 MO', '12 MO', '2 YR', '3 YR'].map((label, i) => ({ label, i, x: 20 + i * 40 }));

  /** Eight lifecycle nodes on a circle, with their outer labels. */
  nodes = LIFECYCLE.map((s, i) => {
    const a = ((i * 45 - 90) * Math.PI) / 180;
    return {
      i, label: s.label, num: String(i + 1).padStart(2, '0'),
      x: 200 + 140 * Math.cos(a), y: 200 + 140 * Math.sin(a),
      lx: 200 + 180 * Math.cos(a), ly: 200 + 180 * Math.sin(a),
    };
  });

  active = signal(0);
  listings = signal<PublicListingDto[]>([]);

  // Hero counters, eased to the live impact figures.
  c1 = signal(0); c2 = signal(0); c3 = signal(0); c4 = signal(0);
  private timers: number[] = [];

  constructor() {
    this.timers.push(window.setInterval(() => this.active.update((a) => (a + 1) % 8), 2500));

    this.api.impact().subscribe({
      next: (d: ImpactDto) => this.runCounters(d),
      error: () => this.runCounters(null),
    });
    this.api.publicListings().subscribe({
      next: (l) => this.listings.set(l.slice(0, 8)),
      error: () => {},
    });
  }

  private runCounters(d: ImpactDto | null): void {
    const listed = d ? Math.round(d.totalCo2DivertedTonnes + d.tonnesUnderContract) : 128450;
    const routed = d ? Math.round(d.totalCo2DivertedTonnes) : 82310;
    const industries = d ? d.verifiedPassports + d.activeClusters : 42;
    const fulfilment = d && d.completedAgreements > 0 ? 1000 : 917; // tenths of a percent
    this.ease(this.c1, listed); this.ease(this.c2, routed);
    this.ease(this.c3, industries); this.ease(this.c4, fulfilment);
  }

  /** Cubic ease-out, matching the reference counter animation. */
  private ease(sig: { set: (v: number) => void }, target: number, duration = 2000): void {
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      sig.set(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stepNum(): string { return String(this.active() + 1).padStart(2, '0'); }

  tickColor(type: string): string { return TICK_COLOR[type] ?? '#30BE69'; }

  /**
   * The green trail around the lifecycle ring. It grows from node 1 and keeps every
   * segment it has covered, rather than showing only the segment currently in play,
   * so the loop visibly closes before it starts again.
   */
  activeArc(): string {
    const reached = this.active();             // 0 at node 1, 7 at node 8
    // Nothing has been traversed yet at the first node, so draw no trail.
    if (reached === 0) return '';

    const point = (step: number) => {
      const a = ((step * 45 - 90) * Math.PI) / 180;
      return { x: 200 + 140 * Math.cos(a), y: 200 + 140 * Math.sin(a) };
    };
    const start = point(0);
    const end = point(reached);                // ends ON the current node, never beyond it
    const largeArc = reached * 45 > 180 ? 1 : 0;
    return `M ${start.x},${start.y} A 140,140 0 ${largeArc},1 ${end.x},${end.y}`;
  }

  ngOnDestroy(): void { this.timers.forEach((t) => clearInterval(t)); }
}
