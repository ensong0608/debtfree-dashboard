import { pathToFileURL } from 'node:url';
import { PREVIEW_ACCOUNT, PREVIEW_DATABASE, PRODUCTION_DATABASE_ID } from './provision-preview-isolation.mjs';

// Read-only metadata inspection. No SQL, payloads, secret values, or token policies are logged.
export async function inspectReleaseResources(accountId, api) {
  if (accountId !== PREVIEW_ACCOUNT) throw new Error('Unexpected Cloudflare account.');
  const database = await api(`/accounts/${accountId}/d1/database/${PRODUCTION_DATABASE_ID}`);
  if (database.name !== 'debtfree-dashboard-prod') throw new Error('Production database identity mismatch.');
  const settings = await api(`/accounts/${accountId}/workers/scripts/debtfree-dashboard/settings`);
  const bindings = settings.bindings ?? [];
  if (!bindings.some(b => b.type === 'd1' && b.name === 'DB' && b.id === PRODUCTION_DATABASE_ID)) throw new Error('Production DB binding mismatch.');
  if (!bindings.some(b => b.name === 'AUTH_PROVIDER' && b.text === 'supabase')) throw new Error('Production Google auth provider mismatch.');
  const deployment = await api(`/accounts/${accountId}/workers/scripts/debtfree-dashboard/deployments`);
  const databases = await api(`/accounts/${accountId}/d1/database?per_page=100`);
  const preview = databases.filter(db => db.name === PREVIEW_DATABASE);
  if (preview.length !== 1 || preview[0].uuid === PRODUCTION_DATABASE_ID) throw new Error('Preview database isolation mismatch.');
  const previewSettings = await api(`/accounts/${accountId}/workers/scripts/${PREVIEW_DATABASE}/settings`);
  if (!(previewSettings.bindings ?? []).some(b => b.type === 'd1' && b.name === 'DB' && b.id === preview[0].uuid)) throw new Error('Preview DB binding mismatch.');
  if ((previewSettings.bindings ?? []).some(b => b.type === 'd1' && b.id === PRODUCTION_DATABASE_ID)) throw new Error('Preview references production D1.');
  return {
    productionDatabase: database.name,
    productionDeployments: (deployment.deployments ?? []).map(d => ({ id: d.id, versions: (d.versions ?? []).map(v => v.version_id) })),
    productionAuthProvider: 'supabase', previewDatabaseSeparate: true,
    limitation: 'Read-only resource and binding inspection only. Account-wide IAM, other tokens/principals, token scope and authenticated authorization remain unverified.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('Cloudflare repository token unavailable.');
    const api = async path => {
      const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
        method: 'GET', headers: { authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN }, signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error('Read-only resource inspection failed: HTTP ' + response.status);
      return data.result;
    };
    console.log(JSON.stringify(await inspectReleaseResources(process.env.CLOUDFLARE_ACCOUNT_ID, api), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Read-only resource inspection unavailable.');
    process.exitCode = 1;
  }
}
