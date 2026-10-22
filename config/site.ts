const instagram = "https://instagram.com/spiceandsaffron";
const facebook = "https://facebook.com/spiceandsaffron";

/**
 * Structured postal address. `site.address` is derived from these parts so the
 * human-readable string and the JSON-LD `PostalAddress` can never drift.
 */
export const addr = {
  street: "12 Café Lane, Hauz Khas",
  locality: "New Delhi",
  region: "Delhi",
  postalCode: "110016",
  country: "IN",
} as const;

export const geo = {
  latitude: 28.5535,
  longitude: 77.1945,
} as const;

export const cuisines = [
  "Indian",
  "North Indian",
  "Tandoori",
  "Mughlai",
  "Café",
] as const;

export const site = {
  name: "Spice & Saffron",
  tagline: "Authentic Indian flavours, thoughtfully prepared.",
  description:
    "A premium Indian café serving hand-crafted curries, tandoori specialities and desserts. Warm atmosphere, honest ingredients, made fresh every day.",
  phone: "+91 98765 43210",
  email: "hello@spiceandsaffron.in",
  address: `${addr.street}, ${addr.locality} ${addr.postalCode}`,
  addr,
  geo,
  cuisines,
  priceRange: "₹₹",
  mapsLink: "https://maps.google.com/?q=Hauz+Khas+New+Delhi",
  openingHours: {
    monday: "11:00 AM – 11:00 PM",
    tuesday: "11:00 AM – 11:00 PM",
    wednesday: "11:00 AM – 11:00 PM",
    thursday: "11:00 AM – 11:00 PM",
    friday: "11:00 AM – 11:30 PM",
    saturday: "9:00 AM – 11:30 PM",
    sunday: "9:00 AM – 11:00 PM",
  },
  instagram,
  facebook,
  sameAs: [instagram, facebook],
  whatsapp: "+919876543210",
  reservationLink: "",
  currency: "INR",
  area: "Hauz Khas, New Delhi",
  images: [
    "/images/hero/hero-dining.jpg",
    "/images/menu/butter-chicken.jpg",
    "/images/gallery/thali-spread.jpg",
  ],
  brand: {
    background: "#faf8f5",
    foreground: "#1f1d1a",
    accent: "#b5452a",
  },
} as const;

export type SiteConfig = typeof site;
