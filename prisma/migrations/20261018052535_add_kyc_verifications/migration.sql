-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('NIN', 'BVN', 'PROOF_OF_ADDRESS', 'LIVENESS');

-- CreateEnum
CREATE TYPE "KycVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tier" INTEGER NOT NULL,
    "document_type" "KycDocumentType" NOT NULL,
    "document_number" TEXT,
    "status" "KycVerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kyc_verifications_tier_range" CHECK (tier BETWEEN 1 AND 3)
);

-- CreateIndex
CREATE INDEX "kyc_verifications_customer_id_idx" ON "kyc_verifications"("customer_id");

-- CreateIndex
CREATE INDEX "kyc_verifications_document_type_document_number_idx" ON "kyc_verifications"("document_type", "document_number");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
