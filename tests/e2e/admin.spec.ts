import { expect, test } from "@playwright/test";

const adminEmail = "admin@spiceandsaffron.in";
const adminPassword = "ChangeMe123!"; // dev/test seed credentials only (§116)

test.describe("admin security", () => {
  test("anonymous visitors are redirected away from the panel", async ({ page }) => {
    await page.goto("/admin/dashboard");

    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("wrong password yields a generic error without enumeration", async ({ page }) => {
    await page.goto("/admin/login");

    await page.locator("#admin-email").fill(adminEmail);
    await page.locator("#admin-password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator("form").getByRole("alert")).toContainText("Invalid credentials");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("a forged session cookie grants nothing", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await context.addCookies([
      { name: "cafe_session", value: "forged-token-value", url: baseURL! },
    ]);

    const page = await context.newPage();
    await page.goto("/admin/dashboard");

    // Render-time guard serves the branded 404 — no dashboard content, no redirect leak.
    await expect(page.getByRole("heading", { name: /left the kitchen/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
    await context.close();
  });
});

test.describe("admin management flows", () => {
  let categoryName: string;

  test.beforeEach(async ({ page }) => {
    categoryName = `E2E Category ${Date.now()}`;

    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(adminEmail);
    await page.locator("#admin-password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("dashboard loads with stats", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total dishes")).toBeVisible();
    await expect(page.getByText("Active categories")).toBeVisible();
  });

  test("create a category, create a dish inside it, then sign out", async ({ page }) => {
    // Category
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "New category" }).click();
    await page.locator("#category-name").fill(categoryName);
    await page
      .locator("#category-description")
      .fill("Category created by the automated end-to-end suite.");
    await page.getByRole("button", { name: "Create category" }).click();

    await expect(page.getByRole("heading", { name: categoryName })).toBeVisible();

    // Dish
    await page.goto("/admin/dishes");
    await page.getByRole("button", { name: "New dish" }).click();
    const dishName = `E2E Dish ${Date.now()}`;
    await page.locator("#dish-name").fill(dishName);
    await page.locator("#dish-category").selectOption({ label: categoryName });
    await page.locator("#dish-price").fill("249");
    await page
      .locator("#dish-description")
      .fill("A test dish that verifies the full admin creation pipeline.");
    await page.getByRole("button", { name: "Create dish" }).click();

    const dishRow = page.getByRole("row", { name: new RegExp(dishName) });
    await expect(dishRow).toBeVisible();

    // Delete dish (confirmation modal), then delete the emptied category.
    await dishRow.getByRole("button", { name: `Delete ${dishName}` }).click();
    await page.getByRole("button", { name: "Delete dish", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(dishName) })).toHaveCount(0);

    await page.goto("/admin/categories");
    const categoryCard = page.getByRole("listitem").filter({ hasText: categoryName });
    await categoryCard.getByRole("button", { name: `Delete ${categoryName}` }).click();
    await page.getByRole("button", { name: "Delete category", exact: true }).click();
    await expect(page.getByRole("heading", { name: categoryName })).toHaveCount(0);

    // Sign out returns to the login screen and clears access.
    const mobileMenu = page.getByRole("button", { name: "Open menu" });
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/admin/dishes");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("messages inbox lists the visitor submission from the public suite", async ({ page }) => {
    await page.goto("/admin/messages");

    await expect(page.getByText("Playwright Visitor").first()).toBeVisible();
    await expect(page.getByText("visitor@e2e.test").first()).toBeVisible();
  });
});
