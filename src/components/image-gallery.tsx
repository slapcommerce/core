import * as React from "react";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IconGripVertical, IconTrash, IconPencil, IconPlus, IconPhoto } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ImageItem } from "@/domain/_base/imageCollection";

interface ImageGalleryProps {
  images: ImageItem[];
  onReorder?: (orderedImageIds: string[]) => void;
  onRemove?: (imageId: string) => void;
  onUpdateAltText?: (imageId: string, altText: string) => void;
  onAdd?: (file: File, altText: string) => Promise<void>;
  maxImages?: number;
  isLoading?: boolean;
  className?: string;
}

interface SortableImageItemProps {
  image: ImageItem;
  onRemove: (imageId: string) => void;
  onEditAltText: (image: ImageItem) => void;
  isPrimary: boolean;
}

function SortableImageItem({
  image,
  onRemove,
  onEditAltText,
  isPrimary,
}: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.imageId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-lg border-2 overflow-hidden bg-muted",
        isDragging ? "opacity-50 border-primary" : "border-border",
        isPrimary && "ring-2 ring-primary"
      )}
    >
      {/* Image */}
      <div className="aspect-square">
        <img
          src={image.urls.small?.original || image.urls.thumbnail?.original || ""}
          alt={image.altText || "Product image"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Primary badge */}
      {isPrimary && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
          Primary
        </div>
      )}

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to reorder"
      >
        <IconGripVertical className="h-4 w-4" />
      </button>

      {/* Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEditAltText(image)}
            className="h-7 px-2"
          >
            <IconPencil className="h-3 w-3 mr-1" />
            Alt Text
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(image.imageId)}
            className="h-7 px-2"
          >
            <IconTrash className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Alt text indicator */}
      {image.altText && (
        <div className="absolute bottom-10 left-2 right-2 text-xs text-muted-foreground bg-background/80 p-1 rounded truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {image.altText}
        </div>
      )}
    </div>
  );
}

export function ImageGallery({
  images,
  onReorder,
  onRemove,
  onUpdateAltText,
  onAdd,
  maxImages = 100,
  isLoading = false,
  className,
}: ImageGalleryProps) {
  const [localImages, setLocalImages] = useState(images);
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [altText, setAltText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync localImages with prop changes
  React.useEffect(() => {
    setLocalImages(images);
  }, [images]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localImages.findIndex((img) => img.imageId === active.id);
      const newIndex = localImages.findIndex((img) => img.imageId === over.id);

      const newOrder = arrayMove(localImages, oldIndex, newIndex);
      setLocalImages(newOrder);
      onReorder?.(newOrder.map((img) => img.imageId));
    }
  };

  const handleRemove = (imageId: string) => {
    if (confirm("Are you sure you want to remove this image?")) {
      onRemove?.(imageId);
    }
  };

  const handleEditAltText = (image: ImageItem) => {
    setEditingImage(image);
    setAltText(image.altText);
  };

  const handleSaveAltText = () => {
    if (editingImage) {
      onUpdateAltText?.(editingImage.imageId, altText);
      setEditingImage(null);
      setAltText("");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAdd) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setIsUploading(true);
    try {
      await onAdd(file, "");
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const isAtMax = localImages.length >= maxImages;
  const isApproachingLimit = localImages.length >= 10;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Images</h3>
          <p className="text-xs text-muted-foreground">
            {localImages.length} {localImages.length === 1 ? "image" : "images"}
            {localImages.length > 0 && " (first is primary)"}
          </p>
        </div>
        {onAdd && (
          <div>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isAtMax || isUploading || isLoading}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={isAtMax || isUploading || isLoading}
              asChild
            >
              <label htmlFor="image-upload" className="cursor-pointer">
                <IconPlus className="h-4 w-4 mr-1" />
                {isUploading ? "Uploading..." : "Add Image"}
              </label>
            </Button>
          </div>
        )}
      </div>

      {isApproachingLimit && !isAtMax && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
          You have {localImages.length} images. Consider limiting for better performance.
        </div>
      )}

      {isAtMax && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded">
          Maximum of {maxImages} images reached.
        </div>
      )}

      {localImages.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <IconPhoto className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">No images yet</p>
          {onAdd && (
            <Button size="sm" variant="outline" asChild>
              <label htmlFor="image-upload" className="cursor-pointer">
                <IconPlus className="h-4 w-4 mr-1" />
                Add your first image
              </label>
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localImages.map((img) => img.imageId)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {localImages.map((image, index) => (
                <SortableImageItem
                  key={image.imageId}
                  image={image}
                  onRemove={handleRemove}
                  onEditAltText={handleEditAltText}
                  isPrimary={index === 0}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Alt Text Edit Dialog */}
      <Dialog
        open={editingImage !== null}
        onOpenChange={(open) => !open && setEditingImage(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Alt Text</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="alt-text">
                Alt Text (for accessibility)
              </Label>
              <Input
                id="alt-text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe this image..."
              />
              <p className="text-xs text-muted-foreground">
                Describe what's in the image for users who can't see it.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingImage(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAltText}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
