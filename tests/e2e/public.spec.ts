import { expect, test } from "@playwright/test";

test.describe("public visitor flows", () => {
  test("homepage presents the café and its navigation", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Indian/i);
    await expect(page.getByRole("link", { name: /Explore (Full )?Menu/i })).toBeVisible();

    if (testInfo.project.name === "mobile-chrome") {
      await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    } else {
      const mainNav = page.getByRole("navigation", { name: "Main navigation" });
      await expect(mainNav).toBeVisible();
      await expect(mainNav.getByRole("link", { name: "Gallery" })).toBeVisible();
    }
  });

  test("menu is served from the database with working category anchors", async ({ page }) => {
    await page.goto("/menu");

    await expect(
      page.getByRole("navigation", { name: "Menu categories" })
    ).toBeVisible();
    await expect(page.getByText("Butter Chicken")).toBeVisible();

    await page
      .getByRole("navigation", { name: "Menu categories" })
      .getByRole("link", { name: "Desserts" })
      .click();
    await expect(page).toHaveURL(/\/menu#desserts$/);
    await expect(page.getByText("Kulfi Falooda")).toBeVisible();
  });

  test("gallery renders published images", async ({ page }) => {
    await page.goto("/gallery");

    const images = page.locator("main img");
    await expect(images.first()).toBeVisible();
    expect(await images.count()).toBeGreaterThan(0);
  });

  test("faq expands answers", async ({ page }) => {
    await page.goto("/faq");

    const firstQuestion = page.locator("details summary").first();
    await firstQuestion.click();
    await expect(page.locator("details[open]").first()).toBeVisible();
  });

  test("contact form validates, then accepts a real submission", async ({ page }) => {
    await page.goto("/contact");

    // Browser-level validation blocks an empty submit.
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contact-name")).toBeFocused();

    await page.locator("#contact-name").fill("Playwright Visitor");
    await page.locator("#contact-email").fill("visitor@e2e.test");
    await page.locator("#contact-subject").fill("E2E smoke test");
    await page
      .locator("#contact-message")
      .fill("This message was submitted by the automated end-to-end suite.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("status")).toContainText("Message received");
  });

  test("unknown routes render the branded 404", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /left the kitchen/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });
});
