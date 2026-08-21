import { cn } from "@/lib/utils/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18" fill="#B5452A" />
      <path
        d="M12 26c1.5-4 4.5-6 8-6s6.5 2 8 6c-1.5 4-4.5 6-8 6s-6.5-2-8-6Z"
        fill="#FAF8F5"
      />
      <path
        d="M20 12c-2.5 0-4.5 2-4.5 4.5 0 1.5.8 2.9 2 3.6a4.5 4.5 0 0 1 5 0c1.2-.7 2-2.1 2-3.6C24.5 14 22.5 12 20 12Z"
        fill="#E7DDD0"
      />
      <path
        d="M20 16.5 22 19h-4l2-2.5Z"
        fill="#B5452A"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("heading-display text-lg tracking-tight", className)}>
      Spice<span className="text-primary">&</span>Saffron
    </span>
  );
}