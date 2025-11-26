import * as React from "react";
import { useVariants, type Variant } from "@/admin/hooks/use-variants";
import { useProducts } from "@/admin/hooks/use-products";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import { Badge } from "@/admin/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/admin/components/ui/select";
import {
    useUpdateVariantDetails,
    useUpdateVariantPrice,
    useUpdateVariantInventory,
    useUpdateVariantSku,
    useAddVariantImage,
    useRemoveVariantImage,
    useAttachVariantDigitalAsset,
    useDetachVariantDigitalAsset,
} from "@/admin/hooks/use-variants";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { SaveStatusIndicator } from "@/admin/components/save-status-indicator";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";
import { ResponsiveImage } from "@/admin/components/responsive-image";
import { IconX, IconPhoto, IconFile, IconDownload, IconTrash } from "@tabler/icons-react";
import { Skeleton } from "@/admin/components/ui/skeleton";
import { Button } from "@/admin/components/ui/button";

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

interface VariantSheetContentProps {
    variantId: string;
    initialVariant?: Variant;
}

export function VariantSheetContent({ variantId, initialVariant }: VariantSheetContentProps) {
    const { data: session } = authClient.useSession();

    // Fetch variant data by ID - this will automatically update when the cache is invalidated
    const { data: variants, isLoading: variantsLoading } = useVariants();
    const variant = React.useMemo(
        () => variants?.find((v) => v.aggregateId === variantId) || initialVariant,
        [variants, variantId, initialVariant]
    );

    // Fetch product to get variant options definition
    const { data: products } = useProducts();
    const product = React.useMemo(
        () => products?.find((p) => p.aggregateId === variant?.productId),
        [products, variant?.productId]
    );

    const updateDetails = useUpdateVariantDetails();
    const updatePrice = useUpdateVariantPrice();
    const updateInventory = useUpdateVariantInventory();
    const updateSku = useUpdateVariantSku();
    const addImage = useAddVariantImage();
    const removeImage = useRemoveVariantImage();
    const attachDigitalAsset = useAttachVariantDigitalAsset();
    const detachDigitalAsset = useDetachVariantDigitalAsset();
    const saveStatus = useSaveStatus();

    const [sku, setSku] = React.useState("");
    const [price, setPrice] = React.useState("");
    const [inventory, setInventory] = React.useState("");
    const [options, setOptions] = React.useState<Record<string, string>>({});

    // Keep a ref to always access the latest variant version
    const variantRef = React.useRef(variant);
    React.useEffect(() => {
        variantRef.current = variant;
    }, [variant]);

    // Track if a save is in progress to prevent concurrent saves
    const isSavingRef = React.useRef(false);

    // Reset form when variant changes
    React.useEffect(() => {
        if (variant) {
            setSku(variant.sku);
            setPrice(variant.price.toString());
            setInventory(variant.inventory.toString());
            setOptions(variant.options);
        }
    }, [variant?.variant_id, variant?.version]);

    // Auto-save hooks
    const skuAutoSave = useAutoSave(sku, (val) => handleAutoSaveSku(val));
    const optionsAutoSave = useAutoSave(options, (val) => handleAutoSaveOptions(val));
    const priceAutoSave = useAutoSave(price, (val) => handleAutoSavePrice(val));
    const inventoryAutoSave = useAutoSave(inventory, (val) => handleAutoSaveInventory(val));

    const handleAutoSaveOptions = async (value: Record<string, string>) => {
        // Prevent concurrent saves
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        // Check if options changed
        if (JSON.stringify(value) === JSON.stringify(currentVariant.options)) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updateDetails.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                options: value,
                expectedVersion: currentVariant.version,
            });
            saveStatus.completeSave();
        } catch (error) {
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update variant options"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleAutoSavePrice = async (value: string) => {
        // Prevent concurrent saves
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const newPrice = parseFloat(value);
        if (isNaN(newPrice) || newPrice === currentVariant.price) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updatePrice.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                price: newPrice,
                expectedVersion: currentVariant.version,
            });
            saveStatus.completeSave();
        } catch (error) {
            setPrice(currentVariant.price.toString());
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update price"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleAutoSaveInventory = async (value: string) => {
        // Prevent concurrent saves
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const newInventory = parseInt(value, 10);
        if (isNaN(newInventory) || newInventory === currentVariant.inventory) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updateInventory.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                inventory: newInventory,
                expectedVersion: currentVariant.version,
            });
            saveStatus.completeSave();
        } catch (error) {
            setInventory(currentVariant.inventory.toString());
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update inventory"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleAutoSaveSku = async (value: string) => {
        // Prevent concurrent saves
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        if (!value.trim() || value === currentVariant.sku) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updateSku.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                sku: value,
                expectedVersion: currentVariant.version,
            });
            saveStatus.completeSave();
        } catch (error) {
            setSku(currentVariant.sku);
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update SKU"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    // Blur handlers for immediate save on focus loss
    const handleSkuBlur = () => skuAutoSave.immediateSave();
    const handlePriceBlur = () => priceAutoSave.immediateSave();
    const handleInventoryBlur = () => inventoryAutoSave.immediateSave();

    // Enter key handlers to trigger immediate save
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    // Change handlers with explicit debouncedSave calls
    const handleSkuChange = (value: string) => {
        setSku(value);
        skuAutoSave.debouncedSave(value);
    };
    const handlePriceChange = (value: string) => {
        setPrice(value);
        priceAutoSave.debouncedSave(value);
    };
    const handleInventoryChange = (value: string) => {
        setInventory(value);
        inventoryAutoSave.debouncedSave(value);
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const file = event.target.files?.[0];
        if (!file) return;

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            // Prevent concurrent saves
            if (isSavingRef.current) {
                toast.error("Please wait for the current save to complete");
                return;
            }

            const base64 = reader.result as string;
            const imageData = base64.split(",")[1] || "";

            // Get fresh variant reference at time of actual save
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
        // Prevent concurrent saves
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

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            // Prevent concurrent saves
            if (isSavingRef.current) {
                toast.error("Please wait for the current save to complete");
                return;
            }

            const base64 = reader.result as string;
            const assetData = base64.split(",")[1] || "";

            // Get fresh variant reference at time of actual save
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
        // Prevent concurrent saves
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

    if ((variantsLoading && !variant) || !variant) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    const hasProductOptions = product?.variant_options && product.variant_options.length > 0;

    return (
        <>
            <div className="flex items-center justify-between gap-4 pb-4">
                <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                        SKU: {variant.sku}
                    </Badge>
                    <Badge
                        variant={
                            variant.status === "active"
                                ? "default"
                                : variant.status === "archived"
                                    ? "secondary"
                                    : "outline"
                        }
                    >
                        {variant.status}
                    </Badge>
                </div>
                <SaveStatusIndicator />
            </div>

            <div className="space-y-6 py-4">
                {/* Details Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Details</h3>

                    <div className="space-y-2">
                        <Label htmlFor="sku">SKU</Label>
                        <Input
                            id="sku"
                            value={sku}
                            onChange={(e) => handleSkuChange(e.target.value)}
                            onBlur={handleSkuBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., PROD-L-BLU"
                        />
                    </div>

                    {hasProductOptions ? (
                        <div className="space-y-4">
                            {product.variant_options.map((option) => (
                                <div key={option.name} className="space-y-2">
                                    <Label>{option.name}</Label>
                                    <Select
                                        value={options[option.name] || ""}
                                        onValueChange={(value) => {
                                            const newOptions = { ...options, [option.name]: value };
                                            setOptions(newOptions);
                                            optionsAutoSave.debouncedSave(newOptions);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={`Select ${option.name}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {option.values.map((value) => (
                                                <SelectItem key={value} value={value}>
                                                    {value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="options">Options</Label>
                            <div className="text-sm text-muted-foreground">
                                No options defined for this product.
                            </div>
                        </div>
                    )}
                </div>

                {/* Pricing Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Pricing</h3>

                    <div className="space-y-2">
                        <Label htmlFor="price">Price ($)</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => handlePriceChange(e.target.value)}
                            onBlur={handlePriceBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Inventory Section - Only for physical products */}
                {product?.fulfillment_type !== "digital" && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Inventory</h3>

                        <div className="space-y-2">
                            <Label htmlFor="inventory">Stock Count</Label>
                            <Input
                                id="inventory"
                                type="number"
                                value={inventory}
                                onChange={(e) => handleInventoryChange(e.target.value)}
                                onBlur={handleInventoryBlur}
                                onKeyDown={handleKeyDown}
                                placeholder="0"
                            />
                        </div>
                    </div>
                )}

                {/* Images Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Images</h3>

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

                        {/* Upload new image */}
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
                {product?.fulfillment_type === "digital" && (
                    <div className="space-y-4">
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
            </div>
        </>
    );
}
