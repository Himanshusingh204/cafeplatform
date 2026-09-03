import "dotenv/config";

import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { slugify } from "../lib/utils/slugify";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@spiceandsaffron.in";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: process.env.ADMIN_NAME ?? "Café Owner",
        role: (process.env.ADMIN_ROLE ?? "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN" | "EDITOR",
      },
    });
    console.log(`Admin created: ${adminEmail}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  // Settings are always seeded (production-safe)
  const settings: Array<{ key: string; value: string }> = [
    { key: "cafeName", value: process.env.CAFE_NAME ?? "Spice & Saffron" },
    { key: "tagline", value: process.env.CAFE_TAGLINE ?? "Authentic Indian flavours, thoughtfully prepared." },
    { key: "phone", value: process.env.CAFE_PHONE ?? "+91 98765 43210" },
    { key: "email", value: process.env.CAFE_EMAIL ?? "hello@spiceandsaffron.in" },
    { key: "address", value: process.env.CAFE_ADDRESS ?? "12 Café Lane, Hauz Khas, New Delhi 110016" },
    { key: "mapsLink", value: process.env.CAFE_MAPS_LINK ?? "https://maps.google.com/?q=Hauz+Khas+New+Delhi" },
    { key: "openingHours", value: process.env.CAFE_OPENING_HOURS ?? JSON.stringify({
      monday: "11:00 AM – 11:00 PM",
      tuesday: "11:00 AM – 11:00 PM",
      wednesday: "11:00 AM – 11:00 PM",
      thursday: "11:00 AM – 11:00 PM",
      friday: "11:00 AM – 11:30 PM",
      saturday: "9:00 AM – 11:30 PM",
      sunday: "9:00 AM – 11:00 PM",
    }) },
    { key: "instagram", value: process.env.CAFE_INSTAGRAM ?? "https://instagram.com/spiceandsaffron" },
    { key: "facebook", value: process.env.CAFE_FACEBOOK ?? "https://facebook.com/spiceandsaffron" },
    { key: "whatsapp", value: process.env.CAFE_WHATSAPP ?? "+919876543210" },
    { key: "reservationLink", value: process.env.CAFE_RESERVATION_LINK ?? "" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log("Settings seeded.");

  // Demo data is only seeded when SEED_DEMO_DATA=true (development only)
  const seedDemoData = process.env.SEED_DEMO_DATA === "true";
  if (!seedDemoData) {
    console.log("Demo data seeding skipped (set SEED_DEMO_DATA=true to include demo data).");
    console.log("Seed complete.");
    return;
  }

  console.log("Seeding demo data...");

  const categories = [
    { name: "Starters", description: "Small plates, big flavour — grilled, tossed and spiced.", sortOrder: 10, image: "/images/menu/paneer-tikka.jpg" },
    { name: "Main Course", description: "Slow-cooked curries and tandoori specialities.", sortOrder: 20, image: "/images/menu/butter-chicken.jpg" },
    { name: "Breads", description: "Tandoor-fresh rotis, naans and layered parathas.", sortOrder: 30, image: "/images/menu/garlic-naan.jpg" },
    { name: "Rice & Biryani", description: "Fragrant long-grain basmati, cooked low and slow.", sortOrder: 40, image: "/images/menu/chicken-biryani.jpg" },
    { name: "Desserts", description: "Mithai, kulfi and warm puddings to finish.", sortOrder: 50, image: "/images/menu/gulab-jamun.jpg" },
    { name: "Beverages", description: "Masala chai, filter coffee and coolers.", sortOrder: 60, image: "/images/menu/masala-chai.jpg" },
  ];

  const createdCategories: Record<string, string> = {};
  for (const category of categories) {
    const slug = slugify(category.name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { image: category.image },
      });
      createdCategories[category.name] = existing.id;
      continue;
    }
    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug,
        description: category.description,
        image: category.image,
        sortOrder: category.sortOrder,
      },
    });
    createdCategories[category.name] = created.id;
    console.log(`Category created: ${category.name}`);
  }

  const dishes: Array<{
    category: string;
    name: string;
    shortDescription: string;
    description: string;
    price: number;
    image: string;
    featured?: boolean;
    vegetarian?: boolean;
    spicy?: boolean;
    prep?: number;
  }> = [
    {
      category: "Starters",
      name: "Paneer Tikka",
      shortDescription: "Charcoal-grilled paneer, smoked peppers and mint chutney.",
      description: "Cottage cheese cubes marinated overnight in spiced yogurt, grilled over charcoal until the edges char, served with mint chutney and pickled onions.",
      price: 299,
      image: "/images/menu/paneer-tikka.jpg",
      vegetarian: true,
      spicy: true,
      featured: true,
      prep: 15,
    },
    {
      category: "Starters",
      name: "Hara Bhara Kebab",
      shortDescription: "Spinach and green pea patties, crisp outside, soft within.",
      description: "Pan-fried patties of spinach, green peas and potato, seasoned with ginger, green chilli and garam masala.",
      price: 249,
      image: "/images/menu/hara-bhara-kebab.jpg",
      vegetarian: true,
      prep: 12,
    },
    {
      category: "Main Course",
      name: "Butter Chicken",
      shortDescription: "Slow-cooked tomato gravy, cream and toasted kasuri methi.",
      description: "Charred chicken simmered in a velvet-smooth tomato-butter gravy with cream and a finishing touch of kasuri methi. Our most-loved dish.",
      price: 349,
      image: "/images/menu/butter-chicken.jpg",
      featured: true,
      prep: 20,
    },
    {
      category: "Main Course",
      name: "Dal Makhani",
      shortDescription: "Black lentils simmered overnight, finished with cream.",
      description: "Urad dal and kidney beans slow-simmered with tomato, garlic and butter until deeply rich, finished with fresh cream.",
      price: 279,
      image: "/images/menu/dal-makhani.jpg",
      vegetarian: true,
      prep: 5,
    },
    {
      category: "Breads",
      name: "Garlic Butter Naan",
      shortDescription: "Tandoor-fired naan brushed with garlic butter.",
      description: "Soft, blistered naan straight from the tandoor, brushed with garlic-infused butter and scattered with coriander.",
      price: 89,
      image: "/images/menu/garlic-naan.jpg",
      vegetarian: true,
      prep: 8,
    },
    {
      category: "Breads",
      name: "Lachha Paratha",
      shortDescription: "Flaky, layered whole-wheat paratha.",
      description: "Hand-stretched whole-wheat dough folded into crisp, flaky layers and griddled until golden.",
      price: 79,
      image: "/images/menu/lachha-paratha.jpg",
      vegetarian: true,
      prep: 10,
    },
    {
      category: "Rice & Biryani",
      name: "Hyderabadi Chicken Biryani",
      shortDescription: "Fragrant basmati, saffron and slow-cooked chicken.",
      description: "Long-grain basmati layered with marinated chicken, saffron, fried onions and mint, sealed and steamed dum-style.",
      price: 329,
      image: "/images/menu/chicken-biryani.jpg",
      spicy: true,
      featured: true,
      prep: 25,
    },
    {
      category: "Desserts",
      name: "Kulfi Falooda",
      shortDescription: "Malai kulfi, vermicelli, rose syrup and basil seeds.",
      description: "Hand-churned malai kulfi served over vermicelli with rose syrup, sweet basil seeds and a dusting of pistachio.",
      price: 199,
      image: "/images/menu/kulfi-falooda.jpg",
      vegetarian: true,
      prep: 5,
    },
    {
      category: "Desserts",
      name: "Gulab Jamun",
      shortDescription: "Warm khoya dumplings in rose-cardamom syrup.",
      description: "Soft khoya dumplings fried golden and soaked in warm rose-cardamom syrup, served with a scoop of vanilla.",
      price: 149,
      image: "/images/menu/gulab-jamun.jpg",
      vegetarian: true,
    },
    {
      category: "Beverages",
      name: "Masala Chai",
      shortDescription: "Assam tea, crushed spices and milk, brewed to order.",
      description: "Strong Assam tea simmered with cardamom, ginger, clove and cinnamon, finished with milk and a palm-sugar option.",
      price: 99,
      image: "/images/menu/masala-chai.jpg",
      vegetarian: true,
      prep: 5,
    },
    {
      category: "Beverages",
      name: "Cold Coffee Frappe",
      shortDescription: "Double-shot espresso, cream and cocoa.",
      description: "Chilled double-shot espresso blended with cream, ice and a hint of cocoa, topped with whipped cream.",
      price: 159,
      image: "/images/menu/cold-coffee.jpg",
      vegetarian: true,
      prep: 4,
    },
  ];

  let sortOrder = 10;
  for (const dish of dishes) {
    const slug = slugify(dish.name);
    const existing = await prisma.dish.findUnique({ where: { slug } });
    if (existing) {
      await prisma.dish.update({
        where: { id: existing.id },
        data: { image: dish.image },
      });
      continue;
    }

    await prisma.dish.create({
      data: {
        categoryId: createdCategories[dish.category],
        name: dish.name,
        slug,
        shortDescription: dish.shortDescription,
        description: dish.description,
        price: dish.price,
        image: dish.image,
        isFeatured: dish.featured ?? false,
        isVegetarian: dish.vegetarian ?? false,
        isSpicy: dish.spicy ?? false,
        preparationTime: dish.prep ?? null,
        sortOrder,
      },
    });
    console.log(`Dish created: ${dish.name}`);
    sortOrder += 10;
  }

  const galleryImages = [
    { title: "Inside the café", altText: "Warm wooden interior of the café with hanging lights", category: "INTERIOR" as const, image: "/images/gallery/interior-01.jpg" },
    { title: "Royal Indian Thali", altText: "Traditional Indian feast spread with curries, breads and rice", category: "FOOD" as const, image: "/images/gallery/thali-spread.jpg" },
    { title: "Tandoor at work", altText: "Chef pulling fresh naan from the tandoor", category: "CHEF" as const, image: "/images/gallery/tandoor-action.jpg" },
    { title: "Paneer Tikka Platter", altText: "Charcoal grilled paneer tikka with mint chutney", category: "FOOD" as const, image: "/images/gallery/paneer-tikka.jpg" },
    { title: "Hyderabadi Biryani", altText: "Dum biryani in a clay handi pot with raita", category: "FOOD" as const, image: "/images/gallery/biryani-handi.jpg" },
    { title: "Cozy Dining Ambiance", altText: "Warm candlelight and rustic wooden tables in the dining room", category: "ATMOSPHERE" as const, image: "/images/gallery/cafe-ambiance.jpg" },
    { title: "Crispy Samosa Platter", altText: "Golden samosas with mint and tamarind chutney", category: "FOOD" as const, image: "/images/gallery/samosa-platter.jpg" },
  ];

  await prisma.galleryImage.deleteMany({});
  for (let i = 0; i < galleryImages.length; i++) {
    const image = galleryImages[i];
    await prisma.galleryImage.create({
      data: {
        title: image.title,
        altText: image.altText,
        imageUrl: image.image,
        category: image.category,
        sortOrder: (i + 1) * 10,
      },
    });
  }
  console.log("Gallery images created.");

  // Seed default coupons
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      discountPercent: 10,
      minOrder: 350,
      isActive: true,
    },
  });
  await prisma.coupon.upsert({
    where: { code: "FEAST20" },
    update: {},
    create: {
      code: "FEAST20",
      discountPercent: 20,
      minOrder: 1000,
      isActive: true,
    },
  });
  console.log("Coupons seeded.");

  // Seed verified customer reviews
  const reviewsCount = await prisma.review.count();
  if (reviewsCount === 0) {
    await prisma.review.createMany({
      data: [
        {
          customerName: "Aarav Sharma",
          rating: 5,
          title: "The Dal Makhani of dreams",
          comment: "Slow-cooked to velvety perfection with just the right touch of smokiness. The garlic naan straight from the tandoor was divine.",
          isApproved: true,
          isFeatured: true,
        },
        {
          customerName: "Priya Nair",
          rating: 5,
          title: "Unmatched ambience in Hauz Khas",
          comment: "Cozy corner table, warm lighting, and the fragrant aroma of whole spices. The Butter Chicken is rich without being overly sweet.",
          isApproved: true,
          isFeatured: true,
        },
        {
          customerName: "Rohan Mukherjee",
          rating: 5,
          title: "Authentic tandoor charcoal taste",
          comment: "The paneer tikka had that true clay oven char and delicate marinade. Best vegetarian spread we have had in Delhi.",
          isApproved: true,
          isFeatured: true,
        },
        {
          customerName: "Meera Sen",
          rating: 4,
          title: "Wonderful family dinner",
          comment: "Prompt and courteous hospitality. The chicken biryani was fragrant and delicately spiced with real saffron threads.",
          isApproved: true,
          isFeatured: false,
        },
      ],
    });
    console.log("Reviews seeded.");
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });