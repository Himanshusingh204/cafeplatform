-- CreateEnum
CREATE TYPE "DiningMode" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "station" TEXT NOT NULL DEFAULT 'HOT_KITCHEN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "diningMode" "DiningMode" NOT NULL DEFAULT 'TAKEAWAY',
ADD COLUMN     "tableNumber" TEXT,
ADD COLUMN     "tip" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DishModifierGroup" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishModifierOption" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DishModifierGroup_dishId_idx" ON "DishModifierGroup"("dishId");

-- CreateIndex
CREATE INDEX "DishModifierGroup_sortOrder_idx" ON "DishModifierGroup"("sortOrder");

-- CreateIndex
CREATE INDEX "DishModifierOption_groupId_idx" ON "DishModifierOption"("groupId");

-- CreateIndex
CREATE INDEX "DishModifierOption_sortOrder_idx" ON "DishModifierOption"("sortOrder");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- AddForeignKey
ALTER TABLE "DishModifierGroup" ADD CONSTRAINT "DishModifierGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishModifierOption" ADD CONSTRAINT "DishModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DishModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
