import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const householdMembers = sqliteTable("household_members", {
  email: text("email").primaryKey(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  role: text("role", { enum: ["owner", "admin", "viewer"] }).notNull(),
  status: text("status", { enum: ["active", "invited"] }).notNull(),
  invitedBy: text("invited_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const householdState = sqliteTable("household_state", {
  householdId: text("household_id").primaryKey().references(() => households.id, { onDelete: "cascade" }),
  payload: text("payload"),
  revision: integer("revision").notNull().default(0),
  updatedBy: text("updated_by"),
  updatedAt: integer("updated_at").notNull(),
});
