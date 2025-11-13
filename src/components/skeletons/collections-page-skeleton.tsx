import { Skeleton } from "@/components/ui/skeleton";
import { IconSearch, IconPlus, IconPhoto } from "@tabler/icons-react";

export function CollectionsPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Create Collection Button */}
      <div className="flex items-center justify-end px-4 lg:px-6">
        <Skeleton className="h-9 px-4 py-2 inline-flex items-center justify-center gap-2 rounded-md">
          <IconPlus className="size-4 opacity-50" />
          <span className="w-24 h-4 bg-current opacity-50 rounded" />
        </Skeleton>
      </div>

      {/* Collections List Content */}
      <div className="flex flex-col gap-6">
        {/* Search Bar */}
        <div className="px-4 lg:px-6">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" />
            <Skeleton className="h-10 w-full pl-10" />
          </div>
        </div>

        {/* Collections List Container */}
        {/* Show individual card skeletons with gaps (matching multiple collections layout) */}
        <div className="flex flex-col gap-4 mx-4 lg:mx-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden transition-all duration-200"
            >
              <div className="group relative transition-all duration-200">
                <div className="flex flex-col md:flex-row items-start gap-3 p-3 md:gap-5 md:p-5">
                  {/* Mobile: Image + Actions Row */}
                  <div className="flex items-start justify-between w-full md:hidden gap-3">
                    {/* Image Placeholder */}
                    <div className="flex-shrink-0 self-start">
                      <div className="flex size-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/60 to-muted/40 transition-all duration-200">
                        <IconPhoto className="size-8 text-muted-foreground/60 transition-colors duration-200" />
                      </div>
                    </div>
                    {/* Mobile Actions - Badge and Kebab */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-start pt-1">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="size-7 rounded-md" />
                    </div>
                  </div>

                  {/* Desktop: Image Placeholder */}
                  <div className="hidden md:flex flex-shrink-0 self-start">
                    <div className="flex size-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/60 to-muted/40 md:size-40 transition-all duration-200">
                      <IconPhoto className="size-8 text-muted-foreground/60 md:size-12 transition-colors duration-200" />
                    </div>
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

                  {/* Desktop Right Actions */}
                  <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full md:h-6 md:w-20" />
                      <Skeleton className="size-7 rounded-md md:size-8" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

