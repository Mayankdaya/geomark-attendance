import { cn } from "@/lib/utils";

/** Shimmering loading placeholder */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton rounded-xl", className)} {...props} />;
}

export { Skeleton };
