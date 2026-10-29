"use client";
import BrighterLandscape from "./brighter-landscape";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { ProgressCarouselScope } from "./progress-view";
import styles from "./debt-scope-carousel.module.css";
export type DebtScopeSlide = { scope: ProgressCarouselScope; label: string; content: ReactNode };
/** Whole-card presentation only; never writes household settings. */
export default function DebtScopeCarousel({ slides, value, onChange, label = "Debt categories" }: {
  slides: DebtScopeSlide[]; value: ProgressCarouselScope; onChange: (scope: ProgressCarouselScope) => void; label?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndex = Math.max(0, slides.findIndex(slide => slide.scope === value));
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const position = () => {
      const slide = element.children.item(activeIndex) as HTMLElement | null;
      if (slide) element.scrollTo({ left: slide.offsetLeft, behavior: "instant" });
    };
    position();
    const resize = new ResizeObserver(position); resize.observe(element);
    return () => resize.disconnect();
  }, [activeIndex]);
  useEffect(() => () => { if (settling.current) clearTimeout(settling.current); }, []);
  function settled() {
    const element = viewport.current;
    if (!element) return;
    const offsets = Array.from(element.children, child => (child as HTMLElement).offsetLeft);
    const nearest = offsets.reduce((best, offset, i) => Math.abs(offset - element.scrollLeft) < Math.abs(offsets[best] - element.scrollLeft) ? i : best, 0);
    if (slides[nearest] && slides[nearest].scope !== value) onChange(slides[nearest].scope);
  }
  function scroll() {
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(settled, 160);
  }
  function step(offset: number) { const next = slides[activeIndex + offset]; if (next) onChange(next.scope); }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1);
  }
  if (!slides.length) return null;
  return <section className={styles.carousel} aria-label={label} aria-roledescription="carousel">
    <div className={styles.viewport} ref={viewport} onScroll={scroll} onScrollEnd={settled} onKeyDown={key} tabIndex={0} aria-label={`${slides[activeIndex].label}, ${activeIndex + 1} of ${slides.length}. Use left and right arrow keys to change category.`}>
      {slides.map((slide, index) => <div key={slide.scope} className={`${styles.slide} brighter-progress-slide`} aria-roledescription="slide" aria-label={`${slide.label}, ${index + 1} of ${slides.length}`} aria-hidden={index !== activeIndex} inert={index !== activeIndex}>
        <BrighterLandscape className="brighter-card-art"/><span className="brighter-encouragement">{slide.scope === "accounts" ? "Every step counts." : slide.scope === "home" ? "Building a brighter tomorrow." : "One payment at a time."}</span>
        <h2 className={styles.heading}>{slide.label}</h2>{slide.content}
      </div>)}
    </div>
    <div className={styles.controls}>
      <button type="button" aria-label="Previous debt category" disabled={activeIndex === 0} onClick={() => step(-1)}>‹</button>
      <button type="button" aria-label="Next debt category" disabled={activeIndex === slides.length - 1} onClick={() => step(1)}>›</button>
    </div>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{slides[activeIndex].label}, {activeIndex + 1} of {slides.length}</span>
  </section>;
}
