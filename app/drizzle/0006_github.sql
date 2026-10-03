CREATE TABLE "github_installations" (
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_user_id_installation_id_pk" PRIMARY KEY("user_id","installation_id")
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;