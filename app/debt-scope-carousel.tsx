"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { ProgressScope } from "./progress-view";
import styles from "./debt-scope-carousel.module.css";

export type DebtScopeSlide = { scope: ProgressScope; label: string; content: ReactNode };

export default function DebtScopeCarousel({ slides, value, onChange, label = "Debt scope" }: {
  slides: DebtScopeSlide[]; value: ProgressScope; onChange: (scope: ProgressScope) => void; label?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, slides.findIndex(slide => slide.scope === value));

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (element.children.item(activeIndex)) element.scrollTo({ left: activeIndex * element.clientWidth, behavior: "instant" });
  }, [activeIndex]);

  function handleScroll() {
    const element = viewport.current;
    if (!element || !slides.length) return;
    const index = Math.max(0, Math.min(slides.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
    if (slides[index] && slides[index].scope !== value) onChange(slides[index].scope);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(slides.length - 1, activeIndex + (event.key === "ArrowRight" ? 1 : -1)));
    if (slides[next]) onChange(slides[next].scope);
  }

  if (!slides.length) return null;

  return <section className={styles.carousel} aria-label={label}>
    <div className={styles.controls}>
      <div className={styles.dots} role="group" aria-label={`${label} pages`}>
        {slides.map((slide, index) => <button key={slide.scope} type="button" className={index === activeIndex ? styles.activeDot : ""} aria-label={`Show ${slide.label}`} aria-current={index === activeIndex ? "page" : undefined} onClick={() => onChange(slide.scope)} />)}
      </div>
    </div>
    <div className={styles.viewport} ref={viewport} onScrollEnd={handleScroll} onKeyDown={handleKeyDown} tabIndex={0} aria-label={`${slides[activeIndex]?.label ?? label}. Swipe or use left and right arrow keys to change scope.`}>
      {slides.map((slide, index) => <div key={slide.scope} className={styles.slide} aria-hidden={index !== activeIndex} inert={index !== activeIndex}>{slide.content}</div>)}
    </div>
  </section>;
}
