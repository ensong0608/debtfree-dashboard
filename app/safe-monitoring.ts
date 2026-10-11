// Deliberately accept no exception, request, email, payload or credential fields.
export function reportServerFailure(event: 'household_read_failed' | 'household_write_failed' | 'household_export_failed') {
  console.error(JSON.stringify({ event }));
}
