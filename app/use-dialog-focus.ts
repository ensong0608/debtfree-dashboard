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
    const closeControl = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>('button[data-dialog-close]:not(.sheet-handle), header button[aria-label^="Close"]:not(.sheet-handle)');
    const prepareSheet = (dialog: HTMLElement) => {
      dialog.classList.add('app-sheet');
      dialog.style.setProperty('max-height','calc(var(--dialog-viewport-height, 100dvh) - 24px)','important');
      dialog.style.setProperty('min-height','0','important');
      dialog.style.setProperty('box-sizing','border-box','important');
      dialog.parentElement?.classList.add('sheet-backdrop');
      if (dialog.querySelector(':scope > .sheet-handle')) return;
      const close = closeControl(dialog);
      if (!close) return;
      close.classList.add('sheet-dismiss');
      const handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'sheet-handle';
      handle.setAttribute('aria-label', 'Close sheet');
      handle.onclick = () => closeControl(dialog)?.click();
      dialog.insertBefore(handle,dialog.firstChild);
      // Confirmation dialogs also get the same explicit X; it invokes Cancel.
      if (!dialog.querySelector('header button[data-dialog-close], header button[aria-label^="Close"]')) {
        const x = document.createElement('button'); x.type = 'button'; x.className = 'sheet-close';
        x.setAttribute('aria-label', 'Close dialog'); x.onclick = () => closeControl(dialog)?.click();
        const header = dialog.querySelector('header');
        if (header) header.appendChild(x); else dialog.insertBefore(x,handle.nextSibling);
      }
    };
    let drag: {dialog: HTMLElement; target: HTMLElement; y: number; time: number; distance: number; pointer: number} | null = null;
    const pointerdown = (event: PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const dialog = target?.closest<HTMLElement>('.app-sheet');
      if (!dialog || dialog !== current || event.button !== 0 || !target) return;
      const handle = target.closest('.sheet-handle');
      if (!handle && (!target.closest('header') || target.closest('button,input,select,textarea,a'))) return;
      drag = {dialog,target,y:event.clientY,time:performance.now(),distance:0,pointer:event.pointerId};
      target.setPointerCapture(event.pointerId);
    };
    const pointermove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      drag.distance = Math.max(0,event.clientY-drag.y);
      drag.dialog.style.setProperty('--sheet-drag', `${drag.distance}px`);
    };
    const pointerup = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const active = drag; drag = null;
      active.dialog.style.removeProperty('--sheet-drag');
      if (event.type !== 'pointercancel' && (active.distance > 88 || active.distance > 40 && active.distance / (performance.now()-active.time) > .6)) {
        event.preventDefault(); closeControl(active.dialog)?.click();
      }
    };
    document.addEventListener('pointerdown',pointerdown);
    document.addEventListener('pointermove',pointermove);
    document.addEventListener('pointerup',pointerup);
    document.addEventListener('pointercancel',pointerup);
    const update = () => {
      measure();
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open][aria-modal="true"]')].filter(dialog => dialog.getClientRects().length > 0);
      dialogs.forEach(prepareSheet);
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
    return () => { document.removeEventListener('pointerdown',pointerdown);document.removeEventListener('pointermove',pointermove);document.removeEventListener('pointerup',pointerup);document.removeEventListener('pointercancel',pointerup);observer.disconnect(); measured.disconnect(); document.removeEventListener("keydown", keydown, true); document.removeEventListener("focusin", focusin); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); document.documentElement.style.removeProperty("--bottom-navigation-height"); document.documentElement.style.removeProperty("--dialog-viewport-top"); document.documentElement.style.removeProperty("--dialog-viewport-height"); };
  }, []);
}
