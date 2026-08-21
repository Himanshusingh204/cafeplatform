import { z } from "zod";
import { forms } from "@/config/limits";

const stripControl = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export const nameSchema = z
  .string({ error: "Please enter a name." })
  .trim()
  .min(2, "Must be at least 2 characters.")
  .max(forms.maxNameLength, "Name is too long.");

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and hyphens.");

export const emailSchema = z
  .string()
  .trim()
  .max(forms.maxEmailLength)
  .transform((value) => value.toLowerCase())
  .pipe(z.email({ error: "Please enter a valid email address." }));

export const phoneSchema = z
  .string()
  .trim()
  .max(forms.maxPhoneLength)
  .regex(/^[+]?[\d\s-]{6,20}$/, "Please enter a valid phone number.")
  .optional()
  .or(z.literal(""));

const priceValue = z.coerce
  .number({ error: "Price must be a number." })
  .positive("Price must be greater than zero.")
  .max(99999, "Price is too high.")
  .transform((value) => Math.round(value * 100) / 100);

export const priceSchema = priceValue;

export const optionalPriceSchema = z
  .union([priceValue, z.literal("").transform(() => undefined)])
  .optional();

export const descriptionSchema = z
  .string({ error: "Please enter a description." })
  .trim()
  .min(forms.minMessageLength, `Description must be at least ${forms.minMessageLength} characters.`)
  .max(forms.maxDescription, "Description is too long.")
  .transform(stripControl);

export const shortDescriptionSchema = z
  .string()
  .trim()
  .max(forms.maxShortDescription)
  .transform(stripControl);

export const booleanSchema = z.boolean().default(false);

export const optionalIntSchema = z.union([z.coerce.number().int().min(1).max(480), z.literal("").transform(() => null)]).optional().nullable();

export const optionalCaloriesSchema = z.union([z.coerce.number().int().min(1).max(5000), z.literal("").transform(() => null)]).optional().nullable();

export const sortOrderSchema = z.coerce.number().int().min(0).max(9999);

export const imageUrlSchema = z.string().trim().max(500).optional().nullable();

export const contactMessageSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  subject: z.string().trim().min(2).max(forms.maxSubjectLength),
  message: descriptionSchema,
  // Honeypot: a real user never fills this. Any value means a bot.
  website: z.string().max(0).optional().default(""),
  // Minimum time the form must have been open (seconds). 0 = bypassed/bot.
  formStart: z.coerce.number().optional().default(0),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(128),
});

export const categoryInputSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional().nullable(),
  image: imageUrlSchema,
  isActive: booleanSchema,
  sortOrder: sortOrderSchema.optional().default(0),
});

export const dishInputSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  categoryId: z.uuid({ error: "Please choose a category." }),
  shortDescription: shortDescriptionSchema,
  description: descriptionSchema,
  price: priceSchema,
  compareAtPrice: optionalPriceSchema,
  image: imageUrlSchema,
  isFeatured: booleanSchema,
  isAvailable: booleanSchema,
  isVegetarian: booleanSchema,
  isVegan: booleanSchema,
  isSpicy: booleanSchema,
  containsNuts: booleanSchema,
  preparationTime: optionalIntSchema,
  calories: optionalCaloriesSchema,
  sortOrder: sortOrderSchema.optional().default(0),
});

export const galleryInputSchema = z.object({
  title: nameSchema,
  altText: nameSchema,
  category: z.enum(["INTERIOR", "FOOD", "CHEF", "EVENTS", "ATMOSPHERE"]),
  sortOrder: sortOrderSchema.optional().default(0),
  isPublished: booleanSchema,
});

export const messageStatusSchema = z.object({
  status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]),
});

export const settingsInputSchema = z.object({
  cafeName: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  phone: z.string().trim().max(20),
  email: emailSchema,
  address: z.string().trim().max(300),
  mapsLink: z.string().trim().max(500),
  openingHours: z.string().trim().max(500),
  instagram: z.string().trim().max(300),
  facebook: z.string().trim().max(300),
  whatsapp: z.string().trim().max(20),
  reservationLink: z.string().trim().max(500),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  sort: z.enum(["name", "price", "createdAt", "sortOrder"]).optional().default("sortOrder"),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
  category: z.string().optional(),
  status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]).optional(),
  search: z.string().trim().max(120).optional(),
  featured: z.enum(["true", "false"]).optional(),
  available: z.enum(["true", "false"]).optional(),
});