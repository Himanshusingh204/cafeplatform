import Link from "next/link";

export default function OrderNotFound() {
  return (
    <div className="container-site max-w-xl py-12 text-center">
      <h1 className="heading-display text-3xl font-bold">Order not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We could not find that order. Check the link in your receipt email, or call the kitchen.
      </p>
      <Link
        href="/menu"
        className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Back to menu
      </Link>
    </div>
  );
}
