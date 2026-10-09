CREATE TABLE "calendar_links" (
	"user_id" text PRIMARY KEY NOT NULL,
	"google_email" varchar(254),
	"refresh_token" text NOT NULL,
	"calendars" jsonb,
	"status" varchar(10) DEFAULT 'ok' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_links" ADD CONSTRAINT "calendar_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;