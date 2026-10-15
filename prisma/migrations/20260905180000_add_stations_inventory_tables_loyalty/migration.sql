-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('ROUND', 'RECTANGLE', 'BOOTH');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'SEATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerUserId" UUID,
ADD COLUMN "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "station" TEXT NOT NULL DEFAULT 'HOT_KITCHEN',
ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "currentStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "parLevel" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "costPerUnit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "quantityRequired" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "tableNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "shape" "TableShape" NOT NULL DEFAULT 'RECTANGLE',
    "posX" INTEGER NOT NULL DEFAULT 100,
    "posY" INTEGER NOT NULL DEFAULT 100,
    "width" INTEGER NOT NULL DEFAULT 120,
    "height" INTEGER NOT NULL DEFAULT 80,
    "section" TEXT NOT NULL DEFAULT 'Main Dining',
    "currentOrderId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "specialNotes" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "estimatedWaitMinutes" INTEGER NOT NULL DEFAULT 15,
    "notifiedAt" TIMESTAMP(3),
    "seatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerUser" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "lifetimeSpend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedger" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID,
    "pointsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_dishId_ingredientId_key" ON "RecipeItem"("dishId", "ingredientId");
CREATE INDEX "RecipeItem_dishId_idx" ON "RecipeItem"("dishId");
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

-- CreateIndex
CREATE INDEX "Ingredient_tenantId_idx" ON "Ingredient"("tenantId");
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "DiningTable_tenantId_idx" ON "DiningTable"("tenantId");
CREATE INDEX "DiningTable_tableNumber_idx" ON "DiningTable"("tableNumber");
CREATE INDEX "DiningTable_status_idx" ON "DiningTable"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_idx" ON "WaitlistEntry"("tenantId");
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");
CREATE INDEX "CustomerUser_tenantId_idx" ON "CustomerUser"("tenantId");
CREATE INDEX "CustomerUser_email_idx" ON "CustomerUser"("email");
CREATE INDEX "CustomerUser_loyaltyTier_idx" ON "CustomerUser"("loyaltyTier");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_customerId_idx" ON "LoyaltyLedger"("customerId");
-- CreateIndex
CREATE INDEX "LoyaltyLedger_orderId_idx" ON "LoyaltyLedger"("orderId");
-- CreateIndex
CREATE INDEX "LoyaltyLedger_createdAt_idx" ON "LoyaltyLedger"("createdAt");

-- CreateIndex
CREATE INDEX "Order_customerUserId_idx" ON "Order"("customerUserId");
CREATE INDEX "OrderItem_station_idx" ON "OrderItem"("station");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUser" ADD CONSTRAINT "CustomerUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
