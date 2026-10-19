"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./info-tooltip.module.css";

export function ExplanationDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId(), bodyId = useId();
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
    const first = controls[0], last = controls[controls.length - 1];
    if (first && last && document.activeElement === (event.shiftKey ? first : last)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    event.stopPropagation();
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <button type="button" className={styles.close} aria-label="Close explanation" onClick={onClose}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17"/></svg></button>
    <h2 id={titleId}>{title}</h2><div id={bodyId} className={styles.body}>{children}</div>
  </dialog>, document.body);
}
export default function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <span className={styles.help}><button type="button" className={styles.trigger} aria-label={"Explain " + label} aria-haspopup="dialog" aria-expanded={open} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>{label}</button>{open && <ExplanationDialog title={label} onClose={() => setOpen(false)}>{children}</ExplanationDialog>}</span>;
}
