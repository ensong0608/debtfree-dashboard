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
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    let current: HTMLElement | null = null;
    let returnTo: HTMLElement | null = null;
    let lastOutside = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
    const focusable = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getClientRects().length > 0);
    const update = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const next = dialogs[dialogs.length - 1] ?? null;
      if (next === current) return;
      if (!current && next) returnTo = lastOutside;
      current = next;
      if (current) { current.tabIndex = -1; if (!current.contains(document.activeElement)) (focusable(current)[0] ?? current).focus(); }
      else if (returnTo?.isConnected) returnTo.focus();
    };
    const keydown = (event: KeyboardEvent) => {
      if (!current || event.key !== "Tab") return;
      const items = focusable(current);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length) { event.preventDefault(); current.focus(); }
      else if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index === items.length - 1 || index < 0)) { event.preventDefault(); items[0].focus(); }
    };
    const focusin = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.closest('[role="dialog"][aria-modal="true"]')) lastOutside = active;
      if (current && !current.contains(document.activeElement)) (focusable(current)[0] ?? current).focus(); };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => { observer.disconnect(); document.removeEventListener("keydown", keydown); document.removeEventListener("focusin", focusin); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); document.documentElement.style.removeProperty("--dialog-viewport-top"); document.documentElement.style.removeProperty("--dialog-viewport-height"); };
  }, []);
}
