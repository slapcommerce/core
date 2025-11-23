import * as React from "react";
import type { Collection } from "@/hooks/use-collections";
import {
  useAddCollectionImage,
  useRemoveCollectionImage,
  useReorderCollectionImages,
  useUpdateCollectionImageAltText,
} from "@/hooks/use-collections";
import { ImageGallery } from "@/components/image-gallery";
import { toast } from "sonner";
import { useSaveStatus } from "@/contexts/save-status-context";

interface CollectionImagesTabProps {
  collection: Collection;
}

// Helper to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1]!;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CollectionImagesTab({ collection }: CollectionImagesTabProps) {
  const addImage = useAddCollectionImage();
  const removeImage = useRemoveCollectionImage();
  const reorderImages = useReorderCollectionImages();
  const updateAltText = useUpdateCollectionImageAltText();
  const saveStatus = useSaveStatus();

  const isArchived = collection.status === "archived";

  const handleAddImage = async (file: File, altText: string) => {
    if (isArchived) {
      toast.error("Cannot modify archived collections");
      return;
    }

    saveStatus.startSaving();
    try {
      const imageData = await fileToBase64(file);
      await addImage.mutateAsync({
        id: collection.collection_id,
        imageData,
        filename: file.name,
        contentType: file.type,
        altText: altText || "",
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
      toast.success("Image added successfully");
    } catch (error) {
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to add image"
      );
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    if (isArchived) {
      toast.error("Cannot modify archived collections");
      return;
    }

    saveStatus.startSaving();
    try {
      await removeImage.mutateAsync({
        id: collection.collection_id,
        imageId,
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
      toast.success("Image removed successfully");
    } catch (error) {
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to remove image"
      );
    }
  };

  const handleReorderImages = async (orderedImageIds: string[]) => {
    if (isArchived) {
      toast.error("Cannot modify archived collections");
      return;
    }

    saveStatus.startSaving();
    try {
      await reorderImages.mutateAsync({
        id: collection.collection_id,
        orderedImageIds,
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder images"
      );
    }
  };

  const handleUpdateAltText = async (imageId: string, altText: string) => {
    if (isArchived) {
      toast.error("Cannot modify archived collections");
      return;
    }

    saveStatus.startSaving();
    try {
      await updateAltText.mutateAsync({
        id: collection.collection_id,
        imageId,
        altText,
        expectedVersion: collection.version,
      });
      saveStatus.completeSave();
      toast.success("Alt text updated successfully");
    } catch (error) {
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update alt text"
      );
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-lg border border-border/60 p-4">
        <ImageGallery
          images={collection.images}
          onReorder={!isArchived ? handleReorderImages : undefined}
          onRemove={!isArchived ? handleRemoveImage : undefined}
          onUpdateAltText={!isArchived ? handleUpdateAltText : undefined}
          onAdd={!isArchived ? handleAddImage : undefined}
          maxImages={100}
          isLoading={
            addImage.isPending ||
            removeImage.isPending ||
            reorderImages.isPending ||
            updateAltText.isPending
          }
        />
        {isArchived && (
          <p className="text-sm text-muted-foreground mt-4">
            This collection is archived. Images cannot be modified.
          </p>
        )}
      </div>
    </div>
  );
}
