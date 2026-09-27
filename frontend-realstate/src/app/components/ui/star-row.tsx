import { Star } from "lucide-react";
import { GOLD } from "./brand";

/** A row of five stars with `value` of them filled (rounded to whole stars). */
export function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < filled ? GOLD : "none"}
          style={{ color: i < filled ? GOLD : "rgba(176,136,72,0.35)" }}
        />
      ))}
    </span>
  );
}
