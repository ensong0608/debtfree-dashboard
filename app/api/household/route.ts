import { householdContext, listMembers } from "./store";
import { createHouseholdApi } from "@/app/household-api";
export const dynamic = "force-dynamic";
const api = createHouseholdApi(householdContext, listMembers);
export const GET = api.GET;
export const PUT = api.PUT;
