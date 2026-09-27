ALTER TABLE "profiles" ADD COLUMN "code" varchar(8) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_code_idx" ON "profiles" USING btree ("code");