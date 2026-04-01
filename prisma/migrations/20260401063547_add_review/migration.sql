-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PRD §6.8: at most one active review per (workflow, user); soft-deleted rows may coexist.
CREATE UNIQUE INDEX "reviews_workflow_user_active_key" ON "reviews" ("workflow_id", "user_id") WHERE "deleted_at" IS NULL;
