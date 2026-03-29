-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('google', 'github');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "AuthProvider" NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_subject_key" ON "users"("provider", "provider_subject");
