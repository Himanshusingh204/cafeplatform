import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function NotFound() {
  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="heading-display text-7xl text-primary md:text-8xl">404</p>
      <h1 className="heading-display mt-4 text-3xl md:text-4xl">This page has left the kitchen</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-8")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>
    </div>
  );
}
