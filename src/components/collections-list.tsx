import * as React from "react"
import type { Collection } from "@/hooks/use-collections"
import { CollectionListItem } from "@/components/collection-list-item"
import { Input } from "@/components/ui/input"
import { IconSearch } from "@tabler/icons-react"

interface CollectionsListProps {
  data: Collection[]
}

export function CollectionsList({ data }: CollectionsListProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredCollections = React.useMemo(() => {
    if (!searchQuery.trim()) return data

    const query = searchQuery.toLowerCase()
    return data.filter(
      (collection) =>
        collection.title.toLowerCase().includes(query) ||
        collection.slug.toLowerCase().includes(query) ||
        collection.short_description.toLowerCase().includes(query)
    )
  }, [data, searchQuery])

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="px-4 lg:px-6">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search collections by name, slug, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Collections List */}
      <div className="rounded-lg border overflow-hidden mx-4 lg:mx-6">
        {filteredCollections.length > 0 ? (
          <div className="divide-y">
            {filteredCollections.map((collection) => (
              <CollectionListItem
                key={collection.collection_id}
                collection={collection}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? `No collections found matching "${searchQuery}"`
                  : "No collections found"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-primary text-sm hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

