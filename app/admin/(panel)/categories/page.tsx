import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { listCategoriesAdmin } from "@/lib/services/menu";
import { hasPermission, permissions } from "@/config/roles";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Categories" };

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = await requirePermission(permissions.VIEW_MENU);
  const categories = await listCategoriesAdmin();

  return (
    <CategoryManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        dishCount: category._count.dishes,
      }))}
      canDelete={hasPermission(admin.role, permissions.DELETE_MENU)}
    />
  );
}
