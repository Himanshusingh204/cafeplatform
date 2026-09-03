import { getSettings } from "@/lib/services/settings";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/hooks/use-cart";
import { CartDrawer } from "@/components/cart/cart-drawer";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader siteName={settings.cafeName} phone={settings.phone} />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={settings} />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}