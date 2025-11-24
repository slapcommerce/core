import { Skeleton } from "@/admin/components/ui/skeleton";

export function GenericPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Page Header */}
            <div className="space-y-2 mb-6">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>

            {/* Content Area */}
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


