import { createLifecycleApi } from '@/app/household-lifecycle';
import { lifecycleConfiguration } from '@/app/auth-config';
import { database, authenticatedUser } from '../store';
export const dynamic = 'force-dynamic';
const api = createLifecycleApi({ db: database, user: authenticatedUser, settings: lifecycleConfiguration });
export const GET = api.GET;
export const POST = api.POST;
