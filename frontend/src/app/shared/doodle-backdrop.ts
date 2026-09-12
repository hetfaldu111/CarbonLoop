import { Component } from '@angular/core';

/**
 * Hand-drawn CO2 molecules, benzene rings, carbon chains, methane stars and sparkles wandering
 * across the page on six different routes.
 *
 * Purely decorative: aria-hidden, ignores the pointer, and every animation stops under
 * prefers-reduced-motion (see the styles in landing.scss). Drop it inside any container that
 * establishes a positioning context and clips overflow.
 */
@Component({
  selector: 'app-doodle-backdrop',
  template: `
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
    </div>`,
})
export class DoodleBackdrop {
  /**
   * Fixed rather than random so the layout is identical on every load; the variety of paths,
   * speeds and negative start delays is what reads as random.
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
}
