"use client";

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";

// domAnimation + `m` keeps the framer-motion payload small; features are
// cached module-level so multiple Reveal wrappers share one provider cost.
export function Reveal({
  children,
  delay = 0,
  duration = 0.65,
  direction = "up",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const offset = {
    up: { y: 22, x: 0 },
    down: { y: -22, x: 0 },
    left: { x: 22, y: 0 },
    right: { x: -22, y: 0 },
    none: { x: 0, y: 0 },
  }[direction];

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, scale: 0.985, ...offset }}
        whileInView={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
