-- CreateEnum
CREATE TYPE "WorkflowNodeSource" AS ENUM ('derived', 'admin');

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "node_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "source" "WorkflowNodeSource" NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_tags" (
    "workflow_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "workflow_tags_pkey" PRIMARY KEY ("workflow_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_tags" ADD CONSTRAINT "workflow_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
