import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  owner: text("owner").primaryKey(),
  started: integer("started").notNull(),
  paidUntil: integer("paid_until").notNull().default(0),
});
export const entries = sqliteTable(
  "entries",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  amount: text("amount").notNull(),
  days: integer("days").notNull(),
  paid: integer("paid").notNull().default(0),
  trade: text("trade").unique(),
});
