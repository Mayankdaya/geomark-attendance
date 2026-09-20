"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-5", className)} {...props} />;
}

/** Underline tabs — editorial hairline rule with an ink active rule. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex w-full items-stretch gap-6 border-b border-line", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent pb-2.5 pt-1 text-sm font-medium text-muted transition-colors cursor-pointer",
        "hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
