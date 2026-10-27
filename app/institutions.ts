// Presentation metadata only. Keys are permanent; never derive them from account names.
// Catalog labels come from the owner's Chase/Citi examples. No trademark assets
// are bundled: official asset provenance and suitable usage terms remain deferred.
export const INSTITUTIONS = [
  { key: 'chase', label: 'Chase' },
  { key: 'citi', label: 'Citi' },
  { key: 'other', label: 'Other' },
] as const;
export type InstitutionKey = typeof INSTITUTIONS[number]['key'];
export function isInstitutionKey(value: unknown): value is InstitutionKey {
  return typeof value === 'string' && value.length <= 32 && INSTITUTIONS.some(entry => entry.key === value);
}
export function validOptionalInstitution(value: unknown) {
  return value === undefined || isInstitutionKey(value);
}
export function institutionPresentation(value: unknown, debtType: string) {
  const institution = INSTITUTIONS.find(entry => entry.key === value);
  const icon = debtType === 'house' || debtType === 'Mortgage' ? 'home'
    : debtType === 'car' || debtType === 'Car loan' || debtType === 'Auto loan' ? 'car'
    : debtType === 'Credit card' ? 'card' : 'money';
  return { label: institution?.label ?? '', icon } as const;
}
