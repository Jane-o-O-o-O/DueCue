import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const members = sqliteTable("members", {
  owner: text("owner").primaryKey(),
  started: integer("started").notNull(),
  paidUntil: integer("paid_until").notNull().default(0),
  permanent: integer("permanent", { mode: "boolean" }).notNull().default(false),
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


export const alipayOrders = sqliteTable("alipay_orders", {
  orderId: text("order_id").primaryKey().notNull().references(() => orders.id),
  owner: text("owner").notNull(),
  mode: text("mode", { enum: ["sandbox", "production"] }).notNull(),
  appId: text("app_id").notNull(),
  status: text("status", { enum: ["pending", "paid", "closed"] }).notNull().default("pending"),
  nextQuery: integer("next_query").notNull(),
  queryAttempts: integer("query_attempts").notNull().default(0),
}, (t) => [
  check("alipay_orders_mode", sql`${t.mode} IN ('sandbox','production')`),
  check("alipay_orders_status", sql`${t.status} IN ('pending','paid','closed')`),
  index("alipay_orders_due").on(t.mode, t.appId, t.status, t.nextQuery),
  uniqueIndex("alipay_pending_owner").on(t.owner, t.mode, t.appId).where(sql`${t.status}='pending'`),
]);

export const alipayNotifications = sqliteTable("alipay_notifications", {
  notifyId: text("notify_id").primaryKey().notNull(),
  orderId: text("order_id").notNull().references(() => orders.id),
  trade: text("trade").notNull(),
  eventType: text("event_type").notNull(),
});

export const alipayRefunds = sqliteTable("alipay_refunds", {
  orderId: text("order_id").notNull().references(() => orders.id),
  requestId: text("request_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["pending", "refunded"] }).notNull().default("pending"),
  created: integer("created").notNull(),
  lastAttempt: integer("last_attempt"),
}, (t) => [
  primaryKey({ columns: [t.orderId, t.requestId] }),
  check("alipay_refunds_amount", sql`${t.amountCents}>0`),
  check("alipay_refunds_status", sql`${t.status} IN ('pending','refunded')`),
]);
