CREATE TABLE "connections" (
	"user_id" text NOT NULL,
	"service" text NOT NULL,
	"status" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_imported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connections_user_id_service_pk" PRIMARY KEY("user_id","service")
);
--> statement-breakpoint
CREATE TABLE "things" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"date" timestamp,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "things" ADD CONSTRAINT "things_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "things_user_source_item" ON "things" USING btree ("user_id","source","source_id");--> statement-breakpoint
CREATE INDEX "things_user_kind" ON "things" USING btree ("user_id","kind");