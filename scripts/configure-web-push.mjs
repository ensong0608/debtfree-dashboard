// Run only by the approved production release, after its encrypted backup.
import {generateKeyPair,exportJWK} from 'jose';
import {spawnSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(process.env.GITHUB_REF!=='refs/heads/codex/production-release-20261015'||account!=='005a72abf0c701cfc067867e4f3ba034'||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('Production configuration required');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/debtfree-dashboard/secrets`,{headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
const result=await response.json();if(!response.ok||!result.success)throw new Error('Could not inspect Worker secret names');
if(result.result.some(secret=>secret.name==='WEB_PUSH_KEYS')){console.log('Existing Web Push signing key retained.');process.exit(0);}
const pair=await generateKeyPair('ES256',{extractable:true});
const publicJwk=await exportJWK(pair.publicKey);
const raw=Buffer.concat([Buffer.from([4]),Buffer.from(publicJwk.x,'base64url'),Buffer.from(publicJwk.y,'base64url')]).toString('base64url');
const value=JSON.stringify({publicKey:raw,privateKey:await exportJWK(pair.privateKey)});
// Secrets go through stdin only, never argv, repository files, logs, or CI artifacts.
const child=spawnSync('npx',['wrangler','secret','put','WEB_PUSH_KEYS','--config','wrangler.jsonc'],{input:value,encoding:'utf8',stdio:['pipe','pipe','pipe']});
if(child.status!==0)throw new Error('Could not configure Web Push signing key');
console.log('Web Push signing key stored as a Worker secret.');
