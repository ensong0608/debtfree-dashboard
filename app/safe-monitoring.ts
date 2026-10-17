// Deliberately accept no exception, request, email, payload or credential fields.
export function reportServerFailure(event: 'household_read_failed' | 'household_write_failed' | 'household_export_failed' | 'household_lifecycle_failed' | 'household_conflict' | 'household_storage_invalid') {
  console.error(JSON.stringify({ event }));
}
