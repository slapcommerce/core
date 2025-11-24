import * as React from "react";
import type { Collection } from "@/admin/hooks/use-collections";
import { CollectionListItem } from "@/admin/components/collection-list-item";
import { CollectionSlideOver } from "@/admin/components/collection-slide-over";
import { Input } from "@/admin/components/ui/input";
import { IconSearch } from "@tabler/icons-react";

interface CollectionsListProps {
  data: Collection[];
}

export function CollectionsList({ data }: CollectionsListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCollection, setSelectedCollection] =
    React.useState<Collection | null>(null);
  const [slideOverOpen, setSlideOverOpen] = React.useState(false);

  // Sync selectedCollection with latest data from React Query after mutations
  React.useEffect(() => {
    if (selectedCollection && data) {
      const updatedCollection = data.find(
        (c) => c.aggregate_id === selectedCollection.aggregate_id
      );
      if (
        updatedCollection &&
        updatedCollection.version !== selectedCollection.version
      ) {
        setSelectedCollection(updatedCollection);
      }
    }
  }, [data, selectedCollection?.aggregate_id, selectedCollection?.version]);

  const handleEditCollection = (collection: Collection) => {
    setSelectedCollection(collection);
    setSlideOverOpen(true);
  };

  const handleSlideOverClose = () => {
    setSlideOverOpen(false);
    // Delay clearing selection to allow slide animation to complete
    setTimeout(() => setSelectedCollection(null), 300);
  };

  const filteredCollections = React.useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter(
      (collection) =>
        collection.title.toLowerCase().includes(query) ||
        collection.slug.toLowerCase().includes(query) ||
        collection.short_description.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Search Bar */}
        <div className="px-4 lg:px-6">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200" />
            <Input
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-input dark:border-input hover:border-input dark:hover:border-input focus-visible:border-ring transition-all duration-200 shadow-sm"
            />
          </div>
        </div>

        {/* Collections List */}
        {filteredCollections.length > 0 ? (
          filteredCollections.length === 1 ? (
            // Single collection: keep original container layout
            <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
              <CollectionListItem
                key={filteredCollections[0]!.collection_id}
                collection={filteredCollections[0]!}
                onEdit={() => handleEditCollection(filteredCollections[0]!)}
              />
            </div>
          ) : (
            // Multiple collections: individual cards with gaps
            <div className="flex flex-col gap-4 mx-4 lg:mx-6">
              {filteredCollections.map((collection) => (
                <div
                  key={collection.collection_id}
                  className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden transition-all duration-200"
                >
                  <CollectionListItem
                    collection={collection}
                    onEdit={() => handleEditCollection(collection)}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="rounded-lg border border-border/60 dark:border-border bg-card shadow-sm overflow-hidden mx-4 lg:mx-6 transition-all duration-200">
            <div className="flex items-center justify-center py-16 text-center">
              <div className="space-y-3 animate-in fade-in duration-300">
                <p className="text-muted-foreground text-sm md:text-base">
                  {searchQuery
                    ? `No collections found matching "${searchQuery}"`
                    : "No collections found"}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-primary text-sm hover:underline transition-colors duration-200 font-medium cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over for editing collections */}
      <CollectionSlideOver
        collection={selectedCollection}
        open={slideOverOpen}
        onOpenChange={handleSlideOverClose}
      />
    </>
  );
}
