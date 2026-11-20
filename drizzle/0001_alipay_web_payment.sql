CREATE TABLE `alipay_notifications` (
	`notify_id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`trade` text NOT NULL,
	`event_type` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `alipay_orders` (
	`order_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`mode` text NOT NULL,
	`app_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`next_query` integer NOT NULL,
	`query_attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "alipay_orders_mode" CHECK("alipay_orders"."mode" IN ('sandbox','production')),
	CONSTRAINT "alipay_orders_status" CHECK("alipay_orders"."status" IN ('pending','paid','closed'))
);
--> statement-breakpoint
CREATE INDEX `alipay_orders_due` ON `alipay_orders` (`mode`,`app_id`,`status`,`next_query`);--> statement-breakpoint
CREATE UNIQUE INDEX `alipay_pending_owner` ON `alipay_orders` (`owner`,`mode`,`app_id`) WHERE "alipay_orders"."status"='pending';--> statement-breakpoint
CREATE TABLE `alipay_refunds` (
	`order_id` text NOT NULL,
	`request_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL,
	`last_attempt` integer,
	PRIMARY KEY(`order_id`, `request_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "alipay_refunds_amount" CHECK("alipay_refunds"."amount_cents">0),
	CONSTRAINT "alipay_refunds_status" CHECK("alipay_refunds"."status" IN ('pending','refunded'))
);
