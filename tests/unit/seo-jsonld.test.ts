/* eslint-disable @typescript-eslint/no-explicit-any -- JSON-LD nodes are loosely typed records */
import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdGraph,
  menuItemSchema,
  restaurantSchema,
  serializeJsonLd,
  websiteSchema,
} from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

describe("seo json-ld builders", () => {
  it("builds the restaurant node only from config/site", () => {
    const r = restaurantSchema() as Record<string, any>;
    expect(r["@type"]).toBe("Restaurant");
    expect(r.telephone).toBe(site.phone);
    expect(r.address.streetAddress).toBe(site.addr.street);
    expect(r.openingHoursSpecification.length).toBeGreaterThan(0);
    for (const spec of r.openingHoursSpecification) {
      expect(spec.opens).toMatch(/^\d{2}:\d{2}$/);
      expect(spec.closes).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("does not claim a SearchAction (no search route exists)", () => {
    expect(JSON.stringify(websiteSchema())).not.toContain("SearchAction");
  });

  it("numbers breadcrumbs and omits the url on the last item", () => {
    const b = breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ" }]) as any;
    expect(b.itemListElement[0].position).toBe(1);
    expect(b.itemListElement[0].item).toMatch(/\/$/);
    expect(b.itemListElement[1].item).toBeUndefined();
  });

  it("builds FAQPage and MenuItem", () => {
    const f = faqSchema([{ question: "Q?", answer: "A." }]) as any;
    expect(f.mainEntity[0].acceptedAnswer.text).toBe("A.");
    const m = menuItemSchema({ name: "Naan", slug: "naan", price: 90, isVegan: true }) as any;
    expect(m.offers.price).toBe("90");
    expect(m.suitableForDiet).toEqual(["https://schema.org/VeganDiet"]);
  });

  it("escapes < so JSON cannot close the script tag", () => {
    const out = serializeJsonLd(jsonLdGraph(faqSchema([{ question: "</script><b>", answer: "x" }])));
    expect(out).not.toContain("<");
    expect(JSON.parse(out)["@graph"][0].mainEntity[0].name).toBe("</script><b>");
  });
});

describe("pageMetadata", () => {
  it("emits canonical, openGraph and twitter", () => {
    const m = pageMetadata({ title: "T", description: "D", path: "/x", images: ["/a.jpg"] });
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph?.title).toBe("T");
    expect(m.twitter?.title).toBe("T");
  });
  it("supports noindex", () => {
    expect(pageMetadata({ title: "T", description: "D", path: "/x", noindex: true }).robots).toEqual({ index: false, follow: false });
  });
});
