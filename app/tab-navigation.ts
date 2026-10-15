/** Horizontal tablists keep a single Tab stop; arrow keys select adjacent tabs. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index + count - 1) % count;
  return null;
}

export function navigateTabs(event: { key: string; currentTarget: HTMLElement; preventDefault: () => void }) {
  const tabs = [...(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not(:disabled)') ?? [])];
  const next = nextTabIndex(event.key, tabs.indexOf(event.currentTarget as HTMLButtonElement), tabs.length);
  if (next === null) return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
