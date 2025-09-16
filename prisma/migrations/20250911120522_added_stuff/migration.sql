/*
  Warnings:

  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `balanceAfter` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `locked` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.

*/
-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Transaction" ALTER COLUMN "amount" DROP DEFAULT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "balanceAfter" DROP DEFAULT,
ALTER COLUMN "balanceAfter" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."Wallet" ALTER COLUMN "balance" DROP DEFAULT,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "locked" DROP DEFAULT,
ALTER COLUMN "locked" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "public"."Gig" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL DEFAULT 'INR',
    "deliveryDays" INTEGER NOT NULL,
    "revisions" INTEGER NOT NULL DEFAULT 1,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thumbnailUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Request" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "currency" "public"."Currency" NOT NULL DEFAULT 'INR',
    "deadline" TIMESTAMP(3),
    "attachments" TEXT[],
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'OPEN',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "coverLetter" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL DEFAULT 'INR',
    "estimatedDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3)
);

-- CreateIndex
CREATE UNIQUE INDEX "Gig_slug_key" ON "public"."Gig"("slug");

-- CreateIndex
CREATE INDEX "Gig_sellerId_idx" ON "public"."Gig"("sellerId");

-- CreateIndex
CREATE INDEX "Gig_category_idx" ON "public"."Gig"("category");

-- CreateIndex
CREATE INDEX "Gig_createdAt_idx" ON "public"."Gig"("createdAt");

-- CreateIndex
CREATE INDEX "Request_clientId_idx" ON "public"."Request"("clientId");

-- CreateIndex
CREATE INDEX "Request_status_createdAt_idx" ON "public"."Request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Request_category_idx" ON "public"."Request"("category");

-- CreateIndex
CREATE INDEX "Proposal_freelancerId_idx" ON "public"."Proposal"("freelancerId");

-- CreateIndex
CREATE INDEX "Proposal_createdAt_idx" ON "public"."Proposal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_requestId_freelancerId_key" ON "public"."Proposal"("requestId", "freelancerId");

-- AddForeignKey
ALTER TABLE "public"."Gig" ADD CONSTRAINT "Gig_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proposal" ADD CONSTRAINT "Proposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proposal" ADD CONSTRAINT "Proposal_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
