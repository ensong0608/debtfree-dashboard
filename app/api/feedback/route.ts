import {householdContext} from '../household/store';
import {authConfiguration} from '../../auth-config';
import {createFeedbackApi} from '../../notification-api';
export const dynamic='force-dynamic';
export const POST=createFeedbackApi(householdContext,()=>authConfiguration().origin);
