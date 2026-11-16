CREATE TABLE `entries` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`owner` text PRIMARY KEY NOT NULL,
	`started` integer NOT NULL,
	`paid_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`amount` text NOT NULL,
	`days` integer NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`trade` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_trade_unique` ON `orders` (`trade`);