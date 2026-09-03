import type { Metadata } from "next";
import { DishManager, type AdminDishRow } from "@/components/admin/dish-manager";
import { listDishesAdmin, listCategoriesAdmin } from "@/lib/services/menu";
import { hasPermission, permissions } from "@/config/roles";
import { requirePermission } from "@/lib/auth/guards";
import { listQuerySchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Dishes" };

export const dynamic = "force-dynamic";

interface DishesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminDishesPage({ searchParams }: DishesPageProps) {
  const admin = await requirePermission(permissions.VIEW_MENU);
  const query = await searchParams;

  const parsed = listQuerySchema.safeParse({
    search: typeof query.search === "string" ? query.search : undefined,
    category: typeof query.category === "string" ? query.category : undefined,
    featured: typeof query.featured === "string" ? query.featured : undefined,
    available: typeof query.available === "string" ? query.available : undefined,
    sort: typeof query.sort === "string" ? query.sort : undefined,
    dir: typeof query.dir === "string" ? query.dir : undefined,
  });

  const filters = parsed.success ? parsed.data : listQuerySchema.parse({});

  const [rows, categories] = await Promise.all([
    listDishesAdmin({
      search: filters.search,
      category: filters.category,
      featured: filters.featured,
      available: filters.available,
      sort: filters.sort,
      dir: filters.dir,
      page: 1,
      pageSize: 200,
    }),
    listCategoriesAdmin(),
  ]);

  const dishes: AdminDishRow[] = rows.items.map((dish) => ({
    id: dish.id,
    name: dish.name,
    categoryId: dish.categoryId,
    categoryName: dish.category.name,
    shortDescription: dish.shortDescription,
    description: dish.description,
    price: Number(dish.price),
    compareAtPrice: dish.compareAtPrice === null ? null : Number(dish.compareAtPrice),
    image: dish.image,
    isFeatured: dish.isFeatured,
    isAvailable: dish.isAvailable,
    isVegetarian: dish.isVegetarian,
    isVegan: dish.isVegan,
    isSpicy: dish.isSpicy,
    containsNuts: dish.containsNuts,
    preparationTime: dish.preparationTime,
    calories: dish.calories,
    sortOrder: dish.sortOrder,
  }));

  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="filter-search" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <input
            id="filter-search"
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Dish name…"
            maxLength={120}
            className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="filter-category" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Category
          </label>
          <select
            id="filter-category"
            name="category"
            defaultValue={filters.category ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-available" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Availability
          </label>
          <select
            id="filter-available"
            name="available"
            defaultValue={filters.available ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Hidden</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Apply
        </button>
      </form>

      <DishManager
        dishes={dishes}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        canDelete={hasPermission(admin.role, permissions.DELETE_MENU)}
      />
    </div>
  );
}
