import { Skeleton } from "@/components/ui/skeleton";
import { IconSearch } from "@tabler/icons-react";

export function CollectionsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="px-4 lg:px-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 opacity-50" />
          <Skeleton className="h-10 w-full pl-10" />
        </div>
      </div>

      {/* Collections List Container */}
      <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
        <div className="divide-y divide-border/60 dark:divide-border">
          {/* Skeleton for 2-3 collection items */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col md:flex-row items-start gap-3 p-3 md:gap-5 md:p-5">
              {/* Mobile: Image + Actions Row */}
              <div className="flex items-start justify-between w-full md:hidden gap-3">
                <Skeleton className="size-24 rounded-lg" />
                <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>

              {/* Desktop: Image Placeholder */}
              <div className="hidden md:flex flex-shrink-0 self-start">
                <Skeleton className="size-40 rounded-lg" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-3 md:space-y-4 w-full md:w-auto">
                {/* Name */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-12 ml-0.5" />
                  <Skeleton className="h-9 w-full md:h-10" />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20 ml-0.5" />
                  <Skeleton className="h-16 w-full md:h-20" />
                </div>

                {/* Slug */}
                <div className="space-y-2">
                  <Skeleton className="h-3 w-10 ml-0.5" />
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Skeleton className="h-7 w-full pl-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0 self-start pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="size-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

