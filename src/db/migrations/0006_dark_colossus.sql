ALTER TABLE "post" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "image" text NOT NULL;