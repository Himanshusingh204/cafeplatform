import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/menu", "/checkout", "/reservations", "/contact", "/loyalty"];
const SCHEMES = ["light", "dark"] as const;

for (const scheme of SCHEMES) {
  test.describe(`a11y (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`${path} has no serious or critical violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical"
        );
        expect(
          blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
          `axe violations on ${path}`
        ).toEqual([]);
      });
    }
  });
}
