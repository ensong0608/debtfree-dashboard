"use client";
import { useEffect } from "react";

/** Keep keyboard focus in the topmost custom dialog and restore its trigger. */
export function useDialogFocus() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const revealField = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches("input, select, textarea") && active.closest('[role="dialog"]')) active.scrollIntoView({ block: "nearest" });
    };
    const resize = () => {
      document.documentElement.style.setProperty("--dialog-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty("--dialog-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      requestAnimationFrame(revealField);
    };
    let observedNav: Element | null = null;
    const measure = () => {
      const nav = document.querySelector<HTMLElement>('.sidebar');
      if (nav !== observedNav) {
        if (observedNav) measured.unobserve(observedNav);
        observedNav = nav;
        if (nav) measured.observe(nav);
      }
      if (nav && window.matchMedia('(max-width:820px)').matches) document.documentElement.style.setProperty('--bottom-navigation-height', `${nav.getBoundingClientRect().height}px`);
    };
    const measured = new ResizeObserver(measure);
    measure();
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    let current: HTMLElement | null = null;
    let returnTo: HTMLElement | null = null;
    let lastOutside = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const lastFocus = new WeakMap<HTMLElement, HTMLElement>();
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
    const focusable = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getClientRects().length > 0);
    const update = () => {
      measure();
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open][aria-modal="true"]')].filter(dialog => dialog.getClientRects().length > 0);
      const next = dialogs[dialogs.length - 1] ?? null;
      if (next === current) return;
      if (!current && next) returnTo = lastOutside;
      current = next;
      if (current) { current.tabIndex = -1; if (!current.contains(document.activeElement)) { const previous = lastFocus.get(current); (previous?.isConnected ? previous : focusable(current)[0] ?? current).focus(); } }
      else {
        // Moving a debt to another group remounts its list button. Resolve the
        // same record's replacement rather than losing keyboard focus.
        const returnId = returnTo?.dataset.dialogReturnId;
        const target = returnTo?.isConnected ? returnTo : returnId
          ? document.querySelector<HTMLElement>(`[data-dialog-return-id="${CSS.escape(returnId)}"]`) : null;
        target?.focus();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (current && event.key === "Escape") {
        const close = current.querySelector<HTMLButtonElement>('header > button[aria-label^="Close"], button[data-dialog-close]');
        if (close && !close.disabled) {
          event.preventDefault();
          event.stopPropagation();
          close.click();
        }
        return;
      }
      if (!current || event.key !== "Tab") return;
      const items = focusable(current);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length) { event.preventDefault(); current.focus(); }
      else if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index === items.length - 1 || index < 0)) { event.preventDefault(); items[0].focus(); }
    };
    const focusin = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const owner = active.closest<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open][aria-modal="true"]');
        if (owner) lastFocus.set(owner, active); else lastOutside = active;
      }
      if (current && !current.contains(document.activeElement)) (focusable(current)[0] ?? current).focus(); };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => { observer.disconnect(); measured.disconnect(); document.removeEventListener("keydown", keydown, true); document.removeEventListener("focusin", focusin); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); document.documentElement.style.removeProperty("--bottom-navigation-height"); document.documentElement.style.removeProperty("--dialog-viewport-top"); document.documentElement.style.removeProperty("--dialog-viewport-height"); };
  }, []);
}
