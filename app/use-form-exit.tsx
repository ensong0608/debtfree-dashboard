"use client";
import { useState } from 'react';
import UnsavedChangesDialog from './unsaved-changes-dialog';

/** The same Back/backdrop confirmation for independently saved form drafts. */
export function useFormExit(subject: string, draft: unknown, onClose: () => void, onSave: () => void, sessionKey?: string) {
  const [initial, setInitial] = useState(() => ({ key: sessionKey, baseline: JSON.stringify(draft) }));
  if (initial.key !== sessionKey) setInitial({ key: sessionKey, baseline: JSON.stringify(draft) });
  const [destination, setDestination] = useState<(() => void) | null>(null);
  const requestExit = (action: () => void) => { if (JSON.stringify(draft) !== initial.baseline) setDestination(() => action); else action(); };
  return {
    requestExit,
    requestClose: () => requestExit(onClose),
    prompt: destination && <UnsavedChangesDialog subject={subject} onSave={() => { setDestination(null); onSave(); }} onDiscard={() => { setDestination(null); destination(); }} onCancel={() => setDestination(null)}/>,
  };
}
