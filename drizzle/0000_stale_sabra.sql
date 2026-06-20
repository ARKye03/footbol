CREATE TABLE `footballer` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`full_name` text,
	`nationality` text,
	`position` text,
	`club` text,
	`league` text NOT NULL,
	`season` integer,
	`birth_year` integer,
	`photo_key` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`attrs` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `footballer_league_idx` ON `footballer` (`league`,`active`);--> statement-breakpoint
CREATE INDEX `footballer_season_idx` ON `footballer` (`season`);--> statement-breakpoint
CREATE TABLE `game_record` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`pool_league` text,
	`pool_season` integer,
	`board_size` integer NOT NULL,
	`player1_id` text NOT NULL,
	`player2_id` text NOT NULL,
	`winner_id` text,
	`end_reason` text NOT NULL,
	`turns` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_player_idx` ON `game_record` (`player1_id`,`player2_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`is_anonymous` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);