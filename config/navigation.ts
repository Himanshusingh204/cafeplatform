export const navigation = [
  { label: "Home", href: "/" },
  { label: "Menu", href: "/menu" },
  { label: "Reservations", href: "/reservations" },
  { label: "About", href: "/about" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
] as const;

export const adminNavigation = [
  { label: "Dashboard", href: "/admin" },
  { label: "Reservations", href: "/admin/reservations" },
  { label: "Takeaway Orders", href: "/admin/orders" },
  { label: "Dishes", href: "/admin/dishes" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Gallery", href: "/admin/gallery" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Activity", href: "/admin/activity" },
] as const;