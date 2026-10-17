import type { DebtAccount } from './dashboard-data.ts';
export type DebtGroup = { id: string; name: string };
export const neutralGroups: DebtGroup[] = [{ id: 'Other', name: 'Household' }];
export function validDisplayName(value: string, max = 40) {
  return value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
// One-time compatibility migration for backups predating explicit group metadata.
// This is never used for newly added debts or households.
export function migrateLegacyGroups(accounts: DebtAccount[], saved?: DebtGroup[]) {
  if (saved) return { accounts, groups: saved };
  if (!accounts.length) return { accounts, groups: neutralGroups };
  const aliases = [['citi1', 'citi 1'], ['discover'], ['chase prime', 'chase amazon', 'amazon prime'], ['penfed', 'pen fed'], ['citi cash', 'citi custom cash'], ['costco'], ['chase freedom'], ['wells fargo'], ['citi double cash', 'double cash'], ['usbconnect', 'us bank connect', 'usbank connect', 'usb connect']];
  return { groups: [{ id: 'Mama', name: 'Mama' }, { id: 'Papi', name: 'Papi' }, { id: 'Other', name: 'Other' }], accounts: accounts.map(account => {
    const name = account.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const index = aliases.findIndex(items => items.some(alias => name === alias || name.startsWith(alias + ' ')));
    return { ...account, displayGroup: account.displayGroup ?? (index < 0 ? 'Other' : index < 5 ? 'Mama' : 'Papi'), displayOrder: account.displayOrder ?? (index < 0 ? Number.MAX_SAFE_INTEGER : index % 5) };
  }) };
}
