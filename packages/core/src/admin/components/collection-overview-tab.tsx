import * as React from "react";
import type { Collection } from "@/admin/hooks/use-collections";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import { Textarea } from "@/admin/components/ui/textarea";
import { Badge } from "@/admin/components/ui/badge";
import { useUpdateCollection } from "@/admin/hooks/use-collections";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface CollectionOverviewTabProps {
  collection: Collection;
}

export function CollectionOverviewTab({
  collection,
}: CollectionOverviewTabProps) {
  const updateCollection = useUpdateCollection();
  const saveStatus = useSaveStatus();

  const [name, setName] = React.useState(collection.title);
  const [description, setDescription] = React.useState(
    collection.short_description
  );
  const [slug, setSlug] = React.useState(collection.slug);
  const [slugError, setSlugError] = React.useState<string | null>(null);

  // Auto-save hooks for each field (debounced)
  const nameAutoSave = useAutoSave(name, (val) =>
    handleAutoSave("name", val)
  );
  const descriptionAutoSave = useAutoSave(description, (val) =>
    handleAutoSave("description", val)
  );
  const slugAutoSave = useAutoSave(slug, (val) => handleAutoSave("slug", val));

  // Reset form when collection changes
  React.useEffect(() => {
    setName(collection.title);
    setDescription(collection.short_description);
    setSlug(collection.slug);
    setSlugError(null);
  }, [
    collection.aggregate_id,
    collection.version,
    collection.title,
    collection.short_description,
    collection.slug,
  ]);

  const handleAutoSave = async (
    field: "name" | "description" | "slug",
    value: string
  ) => {
    // Check if value actually changed
    const currentValue =
      field === "name"
        ? collection.title
        : field === "description"
          ? collection.short_description
          : collection.slug;
    if (value === currentValue) return;

    // Validate slug format
    if (field === "slug") {
      if (!/^[a-z0-9-]+$/.test(value)) {
        setSlugError(
          "Slug must contain only lowercase letters, numbers, and hyphens"
        );
        return;
      }
      setSlugError(null);
    }

    saveStatus.startSaving();
    try {
      await updateCollection.mutateAsync({
        id: collection.collection_id,
        name: field === "name" ? value : name,
        description:
          field === "description" ? value || null : description || null,
        newSlug: field === "slug" ? value : slug,
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      if (field === "name") setName(collection.title);
      if (field === "description")
        setDescription(collection.short_description);
      if (field === "slug") setSlug(collection.slug);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update collection"
      );
    }
  };

  // Blur handlers - immediate save (cancels debounce)
  const handleNameBlur = () => nameAutoSave.immediateSave();
  const handleDescriptionBlur = () => descriptionAutoSave.immediateSave();
  const handleSlugBlur = () => slugAutoSave.immediateSave();

  // Change handlers - debounced save (1000ms after typing stops)
  const handleNameChange = (value: string) => {
    setName(value);
    nameAutoSave.debouncedSave(value);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    descriptionAutoSave.debouncedSave(value);
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    slugAutoSave.debouncedSave(value);
  };

  // Enter key handlers
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const isArchived = collection.status === "archived";

  return (
    <div className="space-y-6 pb-6">
      {/* Collection Details Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Collection Details</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              disabled={isArchived}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={handleDescriptionBlur}
              onKeyDown={handleDescriptionKeyDown}
              rows={3}
              disabled={isArchived}
            />
          </div>
        </div>
      </div>

      {/* Slug Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">URL Slug</h3>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            onBlur={handleSlugBlur}
            onKeyDown={handleSlugKeyDown}
            disabled={isArchived}
          />
          {slugError && (
            <p className="text-xs text-red-600 dark:text-red-400">{slugError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Used in the collection URL: /collections/{slug}
          </p>
        </div>
      </div>

      {/* Status Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Status</h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                collection.status === "active"
                  ? "default"
                  : collection.status === "draft"
                    ? "secondary"
                    : "outline"
              }
            >
              {collection.status}
            </Badge>
            {collection.published_at && (
              <span className="text-xs text-muted-foreground">
                Published {new Date(collection.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
