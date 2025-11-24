import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useState } from "react";
import { useCollections, collectionsQueryOptions } from "@/admin/hooks/use-collections";
import { CollectionsList } from "@/admin/components/collections-list";
import { CollectionsPageSkeleton } from "@/admin/components/skeletons/collections-page-skeleton";
import { Empty } from "@/admin/components/ui/empty";
import { Button } from "@/admin/components/ui/button";
import { IconPlus, IconLoader } from "@tabler/icons-react";
import { CreateCollectionDialog } from "@/admin/components/create-collection-dialog";
import { queryClient } from "@/admin/lib/query-client";

export const productsCollectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products/collections",
  loader: async () => {
    // Prefetch collections data before rendering the page
    await queryClient.ensureQueryData(collectionsQueryOptions());
  },
  component: CollectionsPage,
});


function CollectionsPage() {
  const { data: collections, error, isLoading } = useCollections();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Always render the button to prevent layout shift */}
          <div className="flex items-center justify-end px-4 lg:px-6">
            <Button onClick={() => setIsDialogOpen(true)} disabled={isLoading && !collections}>
              <IconPlus />
              Create Collection
            </Button>
          </div>

          {error && (
            <div className="px-4 lg:px-6">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-destructive">
                  {error instanceof Error
                    ? error.message
                    : "Failed to load collections"}
                </p>
              </div>
            </div>
          )}

          {/* Show skeleton while loading */}
          {!error && collections && collections.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <Empty
                title="No collections found"
                description="Get started by creating your first collection."
                action={{
                  label: "Create Collection",
                  onClick: () => setIsDialogOpen(true),
                }}
              />
            </div>
          ) : !error && collections && collections.length > 0 ? (
            <div className="transition-opacity duration-200">
              <CollectionsList data={collections} />
            </div>
          ) : null}
        </div>
      </div>
      <CreateCollectionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}


