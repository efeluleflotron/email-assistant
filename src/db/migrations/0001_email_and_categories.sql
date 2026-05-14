CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"color" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_category" (
	"emailId" text NOT NULL,
	"categoryId" text NOT NULL,
	CONSTRAINT "email_category_emailId_categoryId_pk" PRIMARY KEY("emailId","categoryId")
);
--> statement-breakpoint
CREATE TABLE "email" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"gmailMessageId" text NOT NULL,
	"gmailThreadId" text,
	"fromEncrypted" text NOT NULL,
	"toEncrypted" text,
	"subjectEncrypted" text,
	"bodyEncrypted" text,
	"receivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_category" ADD CONSTRAINT "email_category_emailId_email_id_fk" FOREIGN KEY ("emailId") REFERENCES "public"."email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_category" ADD CONSTRAINT "email_category_categoryId_category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email" ADD CONSTRAINT "email_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_name_idx" ON "category" USING btree ("userId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "email_user_msg_idx" ON "email" USING btree ("userId","gmailMessageId");