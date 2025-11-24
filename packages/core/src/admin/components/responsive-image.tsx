import * as React from "react"
import type { ImageUploadResult } from "@/api/infrastructure/adapters/imageStorageAdapter"

export type ImageSizePreset = "thumbnail" | "small" | "medium" | "large" | "original"

interface ResponsiveImageProps {
  imageUrls: ImageUploadResult["urls"] | null
  alt: string
  className?: string
  sizePreset?: ImageSizePreset
  sizes?: string
  placeholder?: React.ReactNode
}

// Size width descriptors for srcset
const SIZE_WIDTHS: Record<ImageSizePreset, number> = {
  thumbnail: 200,
  small: 400,
  medium: 800,
  large: 1200,
  original: 2400, // Approximate, actual size varies
}

export function ResponsiveImage({
  imageUrls,
  alt,
  className,
  sizePreset = "medium",
  sizes,
  placeholder,
}: ResponsiveImageProps) {
  // If no image URLs, show placeholder or null
  if (!imageUrls) {
    return placeholder ? <>{placeholder}</> : null
  }

  // Build srcset strings for each format
  const buildSrcSet = (format: "avif" | "webp" | "original"): string => {
    const sources: string[] = []
    
    // Include all sizes up to and including the preset size
    const sizeOrder: ImageSizePreset[] = ["thumbnail", "small", "medium", "large", "original"]
    const presetIndex = sizeOrder.indexOf(sizePreset)
    
    for (let i = 0; i <= presetIndex; i++) {
      const size = sizeOrder[i]!
      const url = imageUrls[size]?.[format]
      if (url) {
        const width = SIZE_WIDTHS[size]
        sources.push(`${url} ${width}w`)
      }
    }
    
    return sources.join(", ")
  }

  const avifSrcSet = buildSrcSet("avif")
  const webpSrcSet = buildSrcSet("webp")
  
  // Fallback URL (use the preset size's original format)
  const fallbackUrl = imageUrls[sizePreset]?.original || imageUrls.medium?.original || imageUrls.small?.original || imageUrls.thumbnail?.original || ""

  // Default sizes attribute if not provided
  const defaultSizes = sizes || "(max-width: 768px) 96px, 160px"

  return (
    <picture>
      {avifSrcSet && (
        <source
          type="image/avif"
          srcSet={avifSrcSet}
          sizes={defaultSizes}
        />
      )}
      {webpSrcSet && (
        <source
          type="image/webp"
          srcSet={webpSrcSet}
          sizes={defaultSizes}
        />
      )}
      <img
        src={fallbackUrl}
        alt={alt}
        className={className}
        sizes={defaultSizes}
        loading="lazy"
      />
    </picture>
  )
}

