ALTER TABLE "post" ADD PRIMARY KEY ("uuid");--> statement-breakpoint
ALTER TABLE "post" ALTER COLUMN "uuid" SET NOT NULL;