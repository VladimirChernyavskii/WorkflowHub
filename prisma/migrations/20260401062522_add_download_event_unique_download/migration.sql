-- CreateTable
CREATE TABLE "download_events" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "user_id" UUID,
    "anon_device_id" TEXT,
    "ip_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counted_unique" BOOLEAN NOT NULL,

    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unique_downloads" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "user_id" UUID,
    "anon_device_id" TEXT,
    "first_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unique_downloads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unique_downloads_user_xor_anon" CHECK (
        ("user_id" IS NOT NULL AND "anon_device_id" IS NULL)
        OR ("user_id" IS NULL AND "anon_device_id" IS NOT NULL)
    )
);

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unique_downloads" ADD CONSTRAINT "unique_downloads_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unique_downloads" ADD CONSTRAINT "unique_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (PRD §6.7): standard UNIQUE allows multiple NULLs; these enforce one row per non-null user or anon key per workflow.
CREATE UNIQUE INDEX "unique_downloads_workflow_user_key" ON "unique_downloads" ("workflow_id", "user_id") WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "unique_downloads_workflow_anon_key" ON "unique_downloads" ("workflow_id", "anon_device_id") WHERE "anon_device_id" IS NOT NULL;
