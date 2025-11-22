import * as React from "react";
import {
  IconCircleCheckFilled,
  IconDotsVertical,
  IconLoader,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Collection } from "@/hooks/use-collections";
import { useArchiveCollection } from "@/hooks/use-collections";

function CollectionActions({ collection }: { collection: Collection }) {
  const archiveMutation = useArchiveCollection();

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      });
      toast.success("Collection archived successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive collection",
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
          size="icon"
        >
          <IconDotsVertical />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        {collection.status !== "archived" && (
          <DropdownMenuItem
            variant="destructive"
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
          >
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CollectionsGrid({ data: initialData }: { data: Collection[] }) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredCollections = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return initialData;
    }
    const query = searchQuery.toLowerCase();
    return initialData.filter((collection) =>
      collection.title.toLowerCase().includes(query),
    );
  }, [initialData, searchQuery]);

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter collections..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {filteredCollections.length > 0 ? (
          filteredCollections.map((collection) => {
            const status = collection.status;
            const createdDate = new Date(collection.created_at);

            return (
              <Card key={collection.collection_id} className="@container/card">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">
                    {collection.title}
                  </CardTitle>
                  {collection.short_description && (
                    <CardDescription>
                      {collection.short_description}
                    </CardDescription>
                  )}
                  <CardAction>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground px-1.5"
                    >
                      {status === "active" ? (
                        <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                      ) : status === "archived" ? (
                        <IconLoader />
                      ) : null}
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex items-center justify-between border-t pt-6">
                  <div className="text-muted-foreground text-sm">
                    Created {createdDate.toLocaleDateString()}
                  </div>
                  <CollectionActions collection={collection} />
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full flex items-center justify-center py-12 px-4">
            <div className="text-muted-foreground text-center">
              {searchQuery
                ? "No collections found matching your search."
                : "No collections found."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
