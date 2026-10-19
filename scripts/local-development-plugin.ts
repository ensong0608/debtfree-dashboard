import type { Plugin } from 'vite';

// Installed only by Vite's local serve mode; never included in a build.
export function localDevelopmentPlugin(): Plugin {
  return {
    name: 'debtfree-local-only-auth',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      if (!id.replaceAll('\\', '/').endsWith('/app/auth.ts')) return;
      if (!source.includes('export async function getAuthenticatedUser() {')) throw new Error('Authentication source changed; review local simulation before continuing.');
      return source.replace('export async function getAuthenticatedUser() {', `export async function getAuthenticatedUser() {
        const { headers, cookies } = await import('next/headers');
        const host = (await headers()).get('host') ?? '';
        if (!/^localhost:\\d+$/.test(host)) return null;
        const email = (await cookies()).get('debtfree-local-user')?.value ?? '';
        if (!['owner','admin','viewer','other','new','production'].some(name => email === name + '@example.test')) return null;
        return { email, displayName: email.split('@')[0], fullName: 'Local test account' };
      }\nasync function productionAuthenticationUnusedLocally() {`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host ?? '';
        if (!/^localhost:\d+$/.test(host)) { res.statusCode = 403; res.end('Use localhost'); return; }
        if (['POST','PUT','PATCH','DELETE'].includes(req.method ?? 'GET') && req.headers.origin !== `http://${host}`) {
          res.statusCode = 403; res.end('Invalid local origin'); return;
        }
        if (req.url?.startsWith('/auth/logout') && req.method === 'POST') {
          res.setHeader('Set-Cookie', 'debtfree-local-user=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
          res.statusCode = 303; res.setHeader('Location', '/__local'); res.end(); return;
        }
        if (!req.url?.startsWith('/__local')) { next(); return; }
        const url = new URL(req.url, `http://${host}`);
        const account = url.searchParams.get('account');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'POST' && ['owner','admin','viewer','other','new','guest','production'].includes(account ?? '')) {
          res.setHeader('Set-Cookie', `debtfree-local-user=${account === 'guest' ? '' : account + '@example.test'}; HttpOnly; SameSite=Strict; Path=/`);
          res.statusCode = 303; res.setHeader('Location', '/'); res.end(); return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<title>DebtFree local accounts</title><h1>Local development accounts</h1><p>Local test identities. The production account opens your imported financial snapshot. No production login is used.</p>' + ['owner','admin','viewer','other','new','guest','production'].map(account => `<form method="post" action="/__local?account=${account}"><button>${account}</button></form>`).join('') + '<p>owner/admin/viewer share Demo Household. other owns Separate Household. new can test household creation. production opens the separately imported production snapshot. guest tests device storage and onboarding.</p>');
      });
    },
  };
}
