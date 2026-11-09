import { Directive, output } from '@angular/core';

const MIN_DISTANCE_PX = 56;
/** Horizontal movement must beat vertical by this factor (avoid fighting page scroll). */
const HORIZONTAL_DOMINANCE = 1.25;

/**
 * Horizontal swipe → previous/next month.
 * Touch/pen only (desktop keeps chevron buttons). Swipe left = next, right = previous.
 */
@Directive({
  selector: '[appSwipeMonth]',
  host: {
    class: 'touch-pan-y select-none',
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'reset()',
    '(lostpointercapture)': 'reset()',
  },
})
export class SwipeMonthDirective {
  /** `-1` previous month, `+1` next month. */
  readonly monthSwipe = output<-1 | 1>();

  private startX = 0;
  private startY = 0;
  private pointerId: number | null = null;

  protected onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      return;
    }
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      this.pointerId = event.pointerId;
      this.startX = event.clientX;
      this.startY = event.clientY;
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        /* capture optional */
      }
    }
  }

  protected onUp(event: PointerEvent): void {
    if (this.pointerId === null || event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    this.reset();

    if (Math.abs(dx) < MIN_DISTANCE_PX) {
      return;
    }
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) {
      return;
    }

    // Swallow the click that would otherwise fire on a day cell after a swipe.
    const host = event.currentTarget as HTMLElement;
    const suppressClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      host.removeEventListener('click', suppressClick, true);
    };
    host.addEventListener('click', suppressClick, true);
    window.setTimeout(() => host.removeEventListener('click', suppressClick, true), 400);

    this.monthSwipe.emit(dx < 0 ? 1 : -1);
  }

  protected reset(): void {
    this.pointerId = null;
  }
}
