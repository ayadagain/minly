DO $$ BEGIN
 CREATE TYPE "public"."op" AS ENUM('rp', 'ec');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "op" "op" NOT NULL;