import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Native-button subset of shadcn/ui (MIT); no Slot/CVA until polymorphism is needed.
export function Button({ className, variant = "default", type = "button", ...props }: ComponentProps<"button"> & { variant?: "default" | "secondary" }) {
  return <button type={type} data-slot="button" className={cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-4 py-3 text-base font-semibold whitespace-normal disabled:cursor-not-allowed disabled:opacity-50",
    variant === "default" ? "bg-primary text-primary-foreground enabled:hover:bg-primary/90" : "border border-input bg-secondary text-secondary-foreground enabled:hover:bg-accent",
    className,
  )} {...props} />;
}
