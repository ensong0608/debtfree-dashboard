"use client";

export default function UnsavedChangesDialog({
  subject,
  onSave,
  onDiscard,
  onCancel,
}: {
  subject: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return <div className="modal-backdrop unsaved-changes-backdrop"><section className="modal unsaved-changes-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
    <h2 id="unsaved-changes-title">Unsaved {subject} changes</h2>
    <p>Save your changes before leaving?</p>
    <footer><button type="button" className="primary" onClick={onSave}>Save</button><button type="button" className="secondary" onClick={onDiscard}>Discard</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></footer>
  </section></div>;
}
