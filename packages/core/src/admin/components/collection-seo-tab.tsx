import * as React from "react";
import type { Collection } from "@/admin/hooks/use-collections";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import { Textarea } from "@/admin/components/ui/textarea";
import { useUpdateCollectionSeoMetadata } from "@/admin/hooks/use-collections";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface CollectionSeoTabProps {
  collection: Collection;
}

export function CollectionSeoTab({ collection }: CollectionSeoTabProps) {
  const updateSeoMetadata = useUpdateCollectionSeoMetadata();
  const saveStatus = useSaveStatus();

  const [metaTitle, setMetaTitle] = React.useState(collection.metaTitle);
  const [metaDescription, setMetaDescription] = React.useState(
    collection.metaDescription
  );

  // Auto-save hooks for each field (debounced)
  const metaTitleAutoSave = useAutoSave(metaTitle, (val) =>
    handleAutoSave("metaTitle", val)
  );
  const metaDescriptionAutoSave = useAutoSave(metaDescription, (val) =>
    handleAutoSave("metaDescription", val)
  );

  // Reset form when collection changes
  React.useEffect(() => {
    setMetaTitle(collection.metaTitle);
    setMetaDescription(collection.metaDescription);
  }, [
    collection.aggregateId,
    collection.version,
    collection.metaTitle,
    collection.metaDescription,
  ]);

  const handleAutoSave = async (
    field: "metaTitle" | "metaDescription",
    value: string
  ) => {
    // Check if value actually changed
    const currentValue =
      field === "metaTitle"
        ? collection.metaTitle
        : collection.metaDescription;
    if (value === currentValue) return;

    saveStatus.startSaving();
    try {
      await updateSeoMetadata.mutateAsync({
        id: collection.aggregateId,
        metaTitle: field === "metaTitle" ? value : metaTitle,
        metaDescription:
          field === "metaDescription" ? value : metaDescription,
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      if (field === "metaTitle") setMetaTitle(collection.metaTitle);
      if (field === "metaDescription")
        setMetaDescription(collection.metaDescription);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update SEO metadata"
      );
    }
  };

  // Blur handlers - immediate save (cancels debounce)
  const handleMetaTitleBlur = () => metaTitleAutoSave.immediateSave();
  const handleMetaDescriptionBlur = () =>
    metaDescriptionAutoSave.immediateSave();

  // Change handlers - debounced save (1000ms after typing stops)
  const handleMetaTitleChange = (value: string) => {
    setMetaTitle(value);
    metaTitleAutoSave.debouncedSave(value);
  };

  const handleMetaDescriptionChange = (value: string) => {
    setMetaDescription(value);
    metaDescriptionAutoSave.debouncedSave(value);
  };

  // Enter key handlers
  const handleMetaTitleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleMetaDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const isArchived = collection.status === "archived";

  return (
    <div className="space-y-6 pb-6">
      {/* SEO Metadata Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div>
          <h3 className="text-sm font-semibold">Search Engine Optimization</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Customize how this collection appears in search engine results.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => handleMetaTitleChange(e.target.value)}
              onBlur={handleMetaTitleBlur}
              onKeyDown={handleMetaTitleKeyDown}
              disabled={isArchived}
              placeholder={collection.name}
            />
            <p className="text-xs text-muted-foreground">
              {metaTitle.length}/60 characters (recommended: 50-60)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={metaDescription}
              onChange={(e) => handleMetaDescriptionChange(e.target.value)}
              onBlur={handleMetaDescriptionBlur}
              onKeyDown={handleMetaDescriptionKeyDown}
              rows={3}
              disabled={isArchived}
              placeholder={collection.description ?? ''}
            />
            <p className="text-xs text-muted-foreground">
              {metaDescription.length}/160 characters (recommended: 120-160)
            </p>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Search Preview</h3>

        <div className="space-y-2 p-3 bg-muted/50 rounded">
          <div className="text-sm text-blue-600 dark:text-blue-400">
            {metaTitle || collection.name}
          </div>
          <div className="text-xs text-green-700 dark:text-green-400">
            https://yourdomain.com/collections/{collection.slug}
          </div>
          <div className="text-xs text-muted-foreground">
            {metaDescription || collection.description}
          </div>
        </div>
      </div>
    </div>
  );
}
