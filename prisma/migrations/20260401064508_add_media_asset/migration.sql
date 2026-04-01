-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "MediaAssetRole" AS ENUM ('input_example', 'output_example');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "role" "MediaAssetRole" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
