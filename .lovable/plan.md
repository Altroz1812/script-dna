
# Fix: React forwardRef Warnings

## Problem
The console shows "Function components cannot be given refs" warnings originating from `Skeleton` being used inside `CardGridSkeleton` and other skeleton components. The `Skeleton` component in `skeleton.tsx` is a plain function component without `React.forwardRef()`, but parent components (Card, CardHeader, etc.) that use `forwardRef` can propagate refs down.

## Fix

### Update `src/components/ui/skeleton.tsx`
Wrap the `Skeleton` component with `React.forwardRef` so it can accept refs without warnings:

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
```

This is a one-file, one-line-level change. No other files need modification.
