import { householdContext } from '../store';
import { createHouseholdExport } from '@/app/household-export';
export const dynamic = 'force-dynamic';
export const GET = createHouseholdExport(householdContext);
