import { cn } from "@/lib/utils";

/** Warm shimmering loading placeholder */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}

export { Skeleton };
