import * as React from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import type { Product } from "@/admin/hooks/use-products";
import {
    useAddVariantImage,
    useRemoveVariantImage,
    useAttachVariantDigitalAsset,
    useDetachVariantDigitalAsset,
} from "@/admin/hooks/use-variants";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { ResponsiveImage } from "@/admin/components/responsive-image";
import { IconX, IconPhoto, IconFile, IconDownload, IconTrash } from "@tabler/icons-react";
import { Button } from "@/admin/components/ui/button";

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

interface VariantImagesTabProps {
    variant: Variant;
    product: Product;
}

export function VariantImagesTab({ variant, product }: VariantImagesTabProps) {
    const { data: session } = authClient.useSession();
    const addImage = useAddVariantImage();
    const removeImage = useRemoveVariantImage();
    const attachDigitalAsset = useAttachVariantDigitalAsset();
    const detachDigitalAsset = useDetachVariantDigitalAsset();

    // Keep a ref to always access the latest variant version
    const variantRef = React.useRef(variant);
    React.useEffect(() => {
        variantRef.current = variant;
    }, [variant]);

    // Track if a save is in progress to prevent concurrent saves
    const isSavingRef = React.useRef(false);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            if (isSavingRef.current) {
                toast.error("Please wait for the current save to complete");
                return;
            }

            const base64 = reader.result as string;
            const imageData = base64.split(",")[1] || "";

            const freshVariant = variantRef.current;
            if (!freshVariant) return;

            isSavingRef.current = true;
            try {
                await addImage.mutateAsync({
                    id: freshVariant.variant_id,
                    userId: session.user.id,
                    imageData,
                    filename: file.name,
                    contentType: file.type,
                    altText: "",
                    expectedVersion: freshVariant.version,
                    fulfillmentType: product.productType,
                });
                toast.success("Image added successfully");
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : "Failed to add image"
                );
            } finally {
                isSavingRef.current = false;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = async (imageId: string) => {
        if (isSavingRef.current) {
            toast.error("Please wait for the current save to complete");
            return;
        }

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        isSavingRef.current = true;
        try {
            await removeImage.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                imageId,
                expectedVersion: currentVariant.version,
                fulfillmentType: product.productType,
            });
            toast.success("Image removed successfully");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to remove image"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleDigitalAssetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            if (isSavingRef.current) {
                toast.error("Please wait for the current save to complete");
                return;
            }

            const base64 = reader.result as string;

            const freshVariant = variantRef.current;
            if (!freshVariant) return;

            isSavingRef.current = true;
            try {
                await attachDigitalAsset.mutateAsync({
                    id: freshVariant.variant_id,
                    userId: session.user.id,
                    assetData: base64,
                    filename: file.name,
                    mimeType: file.type,
                    expectedVersion: freshVariant.version,
                });
                toast.success("Digital asset attached successfully");
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : "Failed to attach digital asset"
                );
            } finally {
                isSavingRef.current = false;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveDigitalAsset = async () => {
        if (isSavingRef.current) {
            toast.error("Please wait for the current save to complete");
            return;
        }

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        isSavingRef.current = true;
        try {
            await detachDigitalAsset.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                expectedVersion: currentVariant.version,
            });
            toast.success("Digital asset removed successfully");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to remove digital asset"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    return (
        <div className="space-y-6 pb-6">
            {/* Images Section */}
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
                <h3 className="text-sm font-semibold">Variant Images</h3>

                <div className="grid grid-cols-3 gap-4">
                    {variant.images.map((image) => (
                        <div key={image.imageId} className="relative group">
                            <ResponsiveImage
                                imageUrls={image.urls}
                                alt={image.altText}
                                className="w-full aspect-square rounded-lg object-cover border-2 border-border"
                                sizePreset="thumbnail"
                                sizes="200px"
                            />
                            <button
                                onClick={() => handleRemoveImage(image.imageId)}
                                className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <IconX className="size-4" />
                            </button>
                        </div>
                    ))}

                    <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                        <IconPhoto className="size-8 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Add Image</span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* Digital Asset Section - Only for digital products */}
            {product.productType === "digital" && (
                <div className="space-y-4 rounded-lg border border-border/60 p-4">
                    <h3 className="text-sm font-semibold">Digital Asset</h3>

                    {variant.digital_asset ? (
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-muted rounded-lg">
                                    <IconFile className="size-6 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{variant.digital_asset.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {variant.digital_asset.mimeType} • {formatFileSize(variant.digital_asset.size)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (variant.digital_asset) {
                                            window.open(`/storage/digital-assets/${variant.digital_asset.fileKey}/${variant.digital_asset.name}`, '_blank');
                                        }
                                    }}
                                    className="flex-1"
                                >
                                    <IconDownload className="size-4 mr-2" />
                                    Download
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleRemoveDigitalAsset}
                                    className="flex-1"
                                >
                                    <IconTrash className="size-4 mr-2" />
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                            <IconFile className="size-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium text-foreground mb-1">Upload Digital Asset</span>
                            <span className="text-xs text-muted-foreground">Any file type accepted</span>
                            <input
                                type="file"
                                onChange={handleDigitalAssetUpload}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>
            )}

            {/* Info Section */}
            <div className="space-y-4 rounded-lg border border-border/60 p-4 bg-muted/30">
                <h3 className="text-sm font-semibold">About Variant Images</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                        <strong>Images:</strong> Add product images specific to this variant.
                        These will be displayed when this variant is selected.
                    </p>
                    {product.productType === "digital" && (
                        <p>
                            <strong>Digital Asset:</strong> The downloadable file customers
                            receive after purchasing this variant.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
