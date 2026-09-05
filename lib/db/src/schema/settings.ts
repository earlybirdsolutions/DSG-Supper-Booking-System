import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  cutoffTime: text("cutoff_time").notNull().default("13:30"),
  kitchenEmails: text("kitchen_emails").array().notNull().default([]),
  financeEmails: text("finance_emails").array().notNull().default([]),
  summaryTime: text("summary_time").notNull().default("13:35"),
  adminEmails: text("admin_emails").array().notNull().default([]),
});

export const insertSettingsSchema = createInsertSchema(settingsTable);
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;