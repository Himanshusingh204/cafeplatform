"use client";

export default function OrderError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="container-site max-w-xl py-12 text-center">
      <h1 className="heading-display text-3xl font-bold">We could not load your order</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong on our side. Your order is safe. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
