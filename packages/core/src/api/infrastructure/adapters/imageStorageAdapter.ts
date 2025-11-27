export interface ImageSizeFormats {
  original: ArrayBuffer;
  webp: ArrayBuffer;
  avif: ArrayBuffer;
}

export interface ImageFormats {
  thumbnail: ImageSizeFormats;
  small: ImageSizeFormats;
  medium: ImageSizeFormats;
  large: ImageSizeFormats;
  original: ImageSizeFormats;
}

export interface ImageUploadResult {
  imageId: string;
  urls: {
    thumbnail: {
      original: string;
      webp: string;
      avif: string;
    };
    small: {
      original: string;
      webp: string;
      avif: string;
    };
    medium: {
      original: string;
      webp: string;
      avif: string;
    };
    large: {
      original: string;
      webp: string;
      avif: string;
    };
    original: {
      original: string;
      webp: string;
      avif: string;
    };
  };
}

export interface ImageStorageAdapter {
  uploadImage(
    formats: ImageFormats,
    imageId: string,
    originalExtension: string
  ): Promise<ImageUploadResult>;
  deleteImage(imageId: string): Promise<void>;
  isLocalStorage(): boolean;
}

