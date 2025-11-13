import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useState } from "react";
import { useCollections } from "@/hooks/use-collections";
import { CollectionsList } from "@/components/collections-list";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { IconPlus, IconLoader } from "@tabler/icons-react";
import { CreateCollectionDialog } from "@/components/create-collection-dialog";

export const productsCollectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/products/collections",
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data: collections, isLoading, error } = useCollections();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12 px-4">
              <div className="flex flex-col items-center gap-2">
                <IconLoader className="animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading collections...</p>
              </div>
            </div>
          )}

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

          {!isLoading && !error && collections && collections.length === 0 && (
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
          )}

          {!isLoading && !error && collections && collections.length > 0 && (
            <>
              <div className="flex items-center justify-end px-4 lg:px-6">
                <Button onClick={() => setIsDialogOpen(true)}>
                  <IconPlus />
                  Create Collection
                </Button>
              </div>
              <CollectionsList data={collections} />
            </>
          )}
        </div>
      </div>
      <CreateCollectionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}


