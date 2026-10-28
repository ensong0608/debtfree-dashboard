"use client";
import TitleSelect from './title-select';

import { useState } from 'react';
import { validDisplayName, type DebtGroup } from './debt-groups';

function categoryError(name: string, groups: DebtGroup[], editingId?: string) {
  if (!validDisplayName(name)) return 'Enter a category name (1–40 characters).';
  if (groups.some(group => group.id !== editingId && group.name.trim().toLowerCase() === name.trim().toLowerCase())) return 'This category already exists.';
  if (!editingId && groups.length >= 20) return 'You can have up to 20 categories.';
  return '';
}

export function DebtCategoryField({ groups, value, onChange, onCreate, onErrorChange }: {
  groups: DebtGroup[]; value: string; onChange: (id: string) => void;
  onCreate: (group: DebtGroup) => void; onErrorChange: (pending: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const cancel = () => { setCreating(false); setName(''); setError(''); onErrorChange(false); };
  const create = () => {
    const message = categoryError(name, groups);
    setError(message);
    if (message) return;
    onCreate({ id: `group-${crypto.randomUUID()}`, name: name.trim() });
    cancel();
  };
  return <div className="debt-category-field">
    <label><span>Debt category</span><TitleSelect aria-label="Debt category" value={creating ? '__new__' : value} onChange={event => {
      if (event.target.value === '__new__') { setCreating(true); onErrorChange(true); }
      else { cancel(); onChange(event.target.value); }
    }}>
      {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      {groups.length < 20 && <option value="__new__">+ Add category…</option>}
    </TitleSelect></label>
    {creating && <div className="category-inline-editor">
      <label><span>New category name</span><input autoFocus value={name} maxLength={40} placeholder="e.g. Shared expenses" aria-invalid={Boolean(error)} aria-describedby={error ? 'new-category-error' : undefined} onChange={event => { setName(event.target.value); setError(''); }} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); create(); }
        if (event.key === 'Escape') { event.stopPropagation(); cancel(); }
      }}/></label>
      {error && <p id="new-category-error" className="form-error" role="alert">{error}</p>}
      <div className="category-editor-actions"><button className="secondary" type="button" onClick={cancel}>Cancel category</button><button className="primary" type="button" onClick={create}>Add category</button></div>
    </div>}
  </div>;
}

export function DebtCategorySettings({ groups, onChange, readOnly }: { groups: DebtGroup[]; onChange: (groups: DebtGroup[]) => void; readOnly: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const cancel = () => { setEditing(null); setName(''); setError(''); };
  const start = (id: string, value: string) => { setEditing(id); setName(value); setError(''); };
  const save = () => {
    if (readOnly || !editing) return;
    const message = categoryError(name, groups, editing === '__new__' ? undefined : editing);
    setError(message);
    if (message) return;
    if (editing === '__new__') onChange([...groups, { id: `group-${crypto.randomUUID()}`, name: name.trim() }]);
    else onChange(groups.map(group => group.id === editing ? { ...group, name: name.trim() } : group));
    cancel();
  };
  const editor = <div className="category-inline-editor">
    <label><span>{editing === '__new__' ? 'New category name' : 'Category name'}</span><input autoFocus value={name} maxLength={40} aria-invalid={Boolean(error)} aria-describedby={error ? 'category-settings-error' : undefined} onChange={event => { setName(event.target.value); setError(''); }} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); save(); }
      if (event.key === 'Escape') cancel();
    }}/></label>
    {error && <p id="category-settings-error" className="form-error" role="alert">{error}</p>}
    <div className="category-editor-actions"><button type="button" className="secondary" onClick={cancel}>Cancel</button><button type="button" className="primary" onClick={save}>Save category</button></div>
  </div>;
  return <section className="roles-card debt-category-settings" aria-label="Debt categories">
    <div className="card-head"><div><span>Debts</span><strong>Debt categories</strong></div></div>
    <div className="category-settings-list">{groups.map(group => <div className="category-settings-row" key={group.id}>
      {editing === group.id ? editor : <><strong>{group.name}</strong>{!readOnly && <button type="button" className="secondary" aria-label={`Edit ${group.name} category`} onClick={() => start(group.id, group.name)}>Edit</button>}</>}
    </div>)}</div>
    {!readOnly && (editing === '__new__' ? editor : !editing && groups.length < 20 && <button type="button" className="secondary category-add-button" onClick={() => start('__new__', '')}>+ Add category</button>)}
  </section>;
}
