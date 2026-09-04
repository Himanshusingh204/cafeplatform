-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gatewayOrderId" TEXT,
ADD COLUMN     "gatewayPaymentId" TEXT,
ADD COLUMN     "gatewaySignature" TEXT,
ADD COLUMN     "paymentMethod" TEXT DEFAULT 'PAY_AT_PICKUP';

-- CreateIndex
CREATE INDEX "Order_gatewayOrderId_idx" ON "Order"("gatewayOrderId");
