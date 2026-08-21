export const navigation = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Menu", href: "/menu" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
] as const;

export const adminNavigation = [
  { label: "Dashboard", href: "/admin" },
  { label: "Dishes", href: "/admin/dishes" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Gallery", href: "/admin/gallery" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Activity", href: "/admin/activity" },
] as const;