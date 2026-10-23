"use client";
import { INSTITUTIONS, isInstitutionKey, type InstitutionKey } from './institutions';

export default function InstitutionPicker({ value, onChange }: { value?: InstitutionKey; onChange: (value: InstitutionKey | undefined) => void }) {
  return <label><span>Institution (optional)</span><select name="institutionKey" value={value ?? ''} onChange={event => onChange(isInstitutionKey(event.target.value) ? event.target.value : undefined)}>
    <option value="">Not selected</option>
    {INSTITUTIONS.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
  </select></label>;
}
