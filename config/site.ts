export const site = {
  name: "Spice & Saffron",
  tagline: "Authentic Indian flavours, thoughtfully prepared.",
  description:
    "A premium Indian café serving hand-crafted curries, tandoori specialities and desserts. Warm atmosphere, honest ingredients, made fresh every day.",
  phone: "+91 98765 43210",
  email: "hello@spiceandsaffron.in",
  address: "12 Café Lane, Hauz Khas, New Delhi 110016",
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
  instagram: "https://instagram.com/spiceandsaffron",
  facebook: "https://facebook.com/spiceandsaffron",
  whatsapp: "+919876543210",
  reservationLink: "",
  currency: "INR",
  area: "Hauz Khas, New Delhi",
} as const;

export type SiteConfig = typeof site;