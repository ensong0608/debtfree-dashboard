"use client";
import type { ButtonHTMLAttributes } from 'react';
export default function BackButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" data-dialog-close className={['form-back-button', props.className].filter(Boolean).join(' ')}>
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5-7 7 7 7"/></svg>
  </button>;
}
