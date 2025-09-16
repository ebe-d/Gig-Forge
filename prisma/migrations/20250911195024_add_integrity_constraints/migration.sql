-- 1) XOR: exactly one of gigId or requestId must be set
ALTER TABLE "Order"
ADD CONSTRAINT order_gig_or_request_xor
CHECK (
((CASE WHEN "gigId" IS NOT NULL THEN 1 ELSE 0 END) +
(CASE WHEN "requestId" IS NOT NULL THEN 1 ELSE 0 END)) = 1
) NOT VALID;

-- 2) commissionPct in [0, 1]
ALTER TABLE "Order"
ADD CONSTRAINT order_commissionpct_0_1
CHECK ("commissionPct" >= 0 AND "commissionPct" <= 1)
NOT VALID;

-- 3) price > 0 and non-negative amounts
ALTER TABLE "Order"
ADD CONSTRAINT order_amounts_nonnegative
CHECK ("commissionAmt" >= 0 AND "escrowAmt" >= 0 AND "price" > 0)
NOT VALID;

-- 4) rating between 1 and 5
ALTER TABLE "Review"
ADD CONSTRAINT review_rating_range
CHECK ("rating" BETWEEN 1 AND 5)
NOT VALID;

-- Validate in-place (lightweight lock, online safe)
ALTER TABLE "Order" VALIDATE CONSTRAINT order_gig_or_request_xor;
ALTER TABLE "Order" VALIDATE CONSTRAINT order_commissionpct_0_1;
ALTER TABLE "Order" VALIDATE CONSTRAINT order_amounts_nonnegative;
ALTER TABLE "Review" VALIDATE CONSTRAINT review_rating_range;