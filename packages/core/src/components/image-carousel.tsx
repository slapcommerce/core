import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ImageItem } from "@/domain/_base/imageCollection";

interface ImageCarouselProps {
  images: ImageItem[];
  className?: string;
  initialIndex?: number;
  showThumbnails?: boolean;
  sizePreset?: "small" | "medium" | "large";
}

export function ImageCarousel({
  images,
  className,
  initialIndex = 0,
  showThumbnails = true,
  sizePreset = "large",
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  // Get the appropriate image URL based on size preset
  const getImageUrl = (image: ImageItem, isThumb = false) => {
    const size = isThumb ? "thumbnail" : sizePreset;
    return (
      image.urls[size]?.webp ||
      image.urls[size]?.original ||
      image.urls.medium?.original ||
      image.urls.small?.original ||
      image.urls.thumbnail?.original ||
      ""
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Image */}
      <div className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
        <img
          src={getImageUrl(currentImage!)}
          alt={currentImage!.altText || `Image ${currentIndex + 1} of ${images.length}`}
          className="w-full h-full object-contain"
        />

        {/* Navigation Arrows (only show if multiple images) */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
                !hasPrevious && "invisible"
              )}
              onClick={goToPrevious}
              disabled={!hasPrevious}
              aria-label="Previous image"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
                !hasNext && "invisible"
              )}
              onClick={goToNext}
              disabled={!hasNext}
              aria-label="Next image"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>

            {/* Image Counter */}
            <div className="absolute bottom-2 right-2 bg-background/80 text-xs px-2 py-1 rounded">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.imageId}
              onClick={() => goToIndex(index)}
              className={cn(
                "flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary"
                  : "border-border hover:border-muted-foreground"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={getImageUrl(image, true)}
                alt={image.altText || `Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Alt Text (if present) */}
      {currentImage?.altText && (
        <p className="text-sm text-muted-foreground text-center">
          {currentImage.altText}
        </p>
      )}
    </div>
  );
}
