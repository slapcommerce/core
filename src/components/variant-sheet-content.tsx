import * as React from "react";
import { useVariants, type Variant } from "@/hooks/use-variants";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    useUpdateVariantDetails,
    useUpdateVariantPrice,
    useUpdateVariantInventory,
    useUpdateVariantSku,
    useAddVariantImage,
    useRemoveVariantImage,
} from "@/hooks/use-variants";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { useSaveStatus } from "@/contexts/save-status-context";
import { useAutoSave } from "@/hooks/use-auto-save";
import { ResponsiveImage } from "@/components/responsive-image";
import { IconX, IconPhoto } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";

interface VariantSheetContentProps {
    variantId: string;
}

export function VariantSheetContent({ variantId }: VariantSheetContentProps) {
    const { data: session } = authClient.useSession();

    // Fetch variant data by ID - this will automatically update when the cache is invalidated
    const { data: variants, isLoading: variantsLoading } = useVariants();
    const variant = React.useMemo(
        () => variants?.find((v) => v.aggregate_id === variantId),
        [variants, variantId]
    );

    const updateDetails = useUpdateVariantDetails();
    const updatePrice = useUpdateVariantPrice();
    const updateInventory = useUpdateVariantInventory();
    const updateSku = useUpdateVariantSku();
    const addImage = useAddVariantImage();
    const removeImage = useRemoveVariantImage();
    const saveStatus = useSaveStatus();

    const [title, setTitle] = React.useState("");
    const [sku, setSku] = React.useState("");
    const [price, setPrice] = React.useState("");
    const [inventory, setInventory] = React.useState("");
    const [barcode, setBarcode] = React.useState("");
    const [optionsInput, setOptionsInput] = React.useState("");

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
            setTitle(variant.title);
            setSku(variant.sku);
            setPrice(variant.price.toString());
            setInventory(variant.inventory.toString());
            setBarcode(variant.barcode || "");
            setOptionsInput(
                Object.entries(variant.options)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(", ")
            );
        }
    }, [variant?.variant_id, variant?.version]);

    // Auto-save hooks
    const titleAutoSave = useAutoSave(title, (val) => handleAutoSaveDetails("title", val));
    const skuAutoSave = useAutoSave(sku, (val) => handleAutoSaveSku(val));
    const optionsAutoSave = useAutoSave(optionsInput, (val) => handleAutoSaveDetails("options", val));
    const barcodeAutoSave = useAutoSave(barcode, (val) => handleAutoSaveDetails("barcode", val));
    const priceAutoSave = useAutoSave(price, (val) => handleAutoSavePrice(val));
    const inventoryAutoSave = useAutoSave(inventory, (val) => handleAutoSaveInventory(val));

    const handleAutoSaveDetails = async (
        field: "title" | "options" | "barcode",
        value: string
    ) => {
        // Prevent concurrent saves
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        // Parse options from input if that's what changed
        const options: Record<string, string> = {};
        const optionsStr = field === "options" ? value : optionsInput;
        optionsStr.split(",").forEach((pair) => {
            const [key, val] = pair.split(":").map((s) => s.trim());
            if (key && val) {
                options[key] = val;
            }
        });

        // Determine what changed
        const optionsChanged = field === "options" && JSON.stringify(options) !== JSON.stringify(currentVariant.options);
        const titleChanged = field === "title" && value !== currentVariant.title;
        const barcodeChanged = field === "barcode" && value !== (currentVariant.barcode || "");

        if (!optionsChanged && !titleChanged && !barcodeChanged) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updateDetails.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                title: field === "title" ? value : title,
                options,
                barcode: field === "barcode" ? (value || null) : (barcode || null),
                expectedVersion: currentVariant.version,
            });
            saveStatus.completeSave();
        } catch (error) {
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update variant details"
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
    const handleTitleBlur = () => titleAutoSave.immediateSave();
    const handleSkuBlur = () => skuAutoSave.immediateSave();
    const handleOptionsBlur = () => optionsAutoSave.immediateSave();
    const handleBarcodeBlur = () => barcodeAutoSave.immediateSave();
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
    const handleTitleChange = (value: string) => {
        setTitle(value);
        titleAutoSave.debouncedSave(value);
    };
    const handleSkuChange = (value: string) => {
        setSku(value);
        skuAutoSave.debouncedSave(value);
    };
    const handleOptionsChange = (value: string) => {
        setOptionsInput(value);
        optionsAutoSave.debouncedSave(value);
    };
    const handleBarcodeChange = (value: string) => {
        setBarcode(value);
        barcodeAutoSave.debouncedSave(value);
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
                    altText: freshVariant.title,
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

    if (variantsLoading || !variant) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

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
                        <Label htmlFor="title">Variant Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., Large / Blue"
                        />
                    </div>

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

                    <div className="space-y-2">
                        <Label htmlFor="options">Options</Label>
                        <Input
                            id="options"
                            value={optionsInput}
                            onChange={(e) => handleOptionsChange(e.target.value)}
                            onBlur={handleOptionsBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., Size: Large, Color: Blue"
                        />
                        <p className="text-xs text-muted-foreground">
                            Format: Key: Value, separated by commas
                        </p>
                    </div>
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

                {/* Inventory Section */}
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

                {/* Physical Attributes Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Physical Attributes</h3>

                    <div className="space-y-2">
                        <Label htmlFor="barcode">Barcode</Label>
                        <Input
                            id="barcode"
                            value={barcode}
                            onChange={(e) => handleBarcodeChange(e.target.value)}
                            onBlur={handleBarcodeBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="Optional"
                        />
                    </div>
                </div>

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
            </div>
        </>
    );
}
