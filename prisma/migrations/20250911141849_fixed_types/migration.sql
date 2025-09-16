/*
  Warnings:

  - You are about to drop the column `commisionPct` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `commisonAmt` on the `Order` table. All the data in the column will be lost.
  - Added the required column `commissionAmt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "commisionPct",
DROP COLUMN "commisonAmt",
ADD COLUMN     "commissionAmt" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0.10;
