# DATABASE_SCHEMA.md

PostgreSQL via Prisma. All changes are migration-based. See `prisma/schema.prisma`.

## Models

### Admin
- `id` (uuid, PK)
- `email` (unique)
- `passwordHash` (Argon2id)
- `name`
- `role` (enum: SUPER_ADMIN, ADMIN, EDITOR)
- `isActive` (bool)
- `lastLoginAt` (nullable)
- `createdAt` / `updatedAt`

### Session
- `id` (uuid PK)
- `tokenHash` (unique — sha256 of the session token; raw token never stored)
- `adminId` (FK → Admin, cascade delete)
- `expiresAt`
- `createdAt`
- `lastUsedAt`

### Category
- `id` (uuid PK)
- `name`
- `slug` (unique)
- `description` (nullable)
- `image` (nullable)
- `isActive`
- `sortOrder` (int)
- `deletedAt` (nullable — soft delete)
- `createdAt` / `updatedAt`
- Relations: `dishes`

### Dish
- `id` (uuid PK)
- `categoryId` (FK → Category)
- `name`
- `slug` (unique)
- `shortDescription`
- `description`
- `price` (Decimal 10,2, positive)
- `compareAtPrice` (nullable Decimal)
- `image`
- `isFeatured`
- `isAvailable`
- `isVegetarian`
- `isVegan`
- `isSpicy`
- `containsNuts`
- `preparationTime` (nullable int, minutes)
- `calories` (nullable int)
- `sortOrder` (int)
- `deletedAt` (nullable — soft delete)
- `createdAt` / `updatedAt`

### GalleryImage
- `id` (uuid PK)
- `title`
- `altText`
- `imageUrl`
- `category` (enum: INTERIOR, FOOD, CHEF, EVENTS, ATMOSPHERE)
- `sortOrder`
- `isPublished`
- `createdAt` / `updatedAt`

### ContactMessage
- `id` (uuid PK)
- `name`
- `email`
- `phone` (nullable)
- `subject`
- `message`
- `status` (enum: NEW, READ, REPLIED, ARCHIVED)
- `ipHash` (nullable — sha256, for rate-limit forensics)
- `createdAt`

### ActivityLog
- `id` (uuid PK)
- `actorId` (FK → Admin, nullable on delete set null)
- `action` (enum: LOGIN, LOGOUT, LOGIN_FAILED, CREATE, UPDATE, DELETE, PUBLISH, UNPUBLISH, FEATURE, SETTINGS_CHANGED, etc.)
- `entityType` (e.g. "DISH", "CATEGORY", "GALLERY", "MESSAGE", "SETTING")
- `entityId` (nullable)
- `metadata` (JSONB, nullable)
- `createdAt`

### Setting
- `id` (uuid PK)
- `key` (unique)
- `value` (Text)
- `updatedAt`

Known keys: `cafeName`, `tagline`, `phone`, `email`, `address`, `mapsLink`, `openingHours`, `instagram`, `facebook`, `whatsapp`, `reservationLink`.

## Enums

`AdminRole`, `GalleryCategory`, `MessageStatus`, `ActivityAction`.

## Indexes

- `Dish.categoryId`, `Dish.slug`, `Dish.isActive`, `Dish.isFeatured`, `Dish.sortOrder`, `Dish.createdAt`
- `Category.slug`, `Category.sortOrder`
- `ContactMessage.status`, `ContactMessage.createdAt`
- `ActivityLog.createdAt`, `ActivityLog.actorId`
- `Session.tokenHash`, `Session.adminId`, `Session.expiresAt`

## Integrity

- Foreign keys + cascade rules defined in schema.
- Unique constraints on slugs and admin email.
- `Dish.price` constrained positive via validation layer + check.
- Transactions for multi-step writes.