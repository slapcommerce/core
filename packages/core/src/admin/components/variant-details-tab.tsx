import * as React from "react";
import type { Variant } from "@/admin/hooks/use-variants";
import type { Product } from "@/admin/hooks/use-products";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
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
} from "@/admin/hooks/use-variants";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface VariantDetailsTabProps {
    variant: Variant;
    product: Product;
}

export function VariantDetailsTab({ variant, product }: VariantDetailsTabProps) {
    const { data: session } = authClient.useSession();
    const updateDetails = useUpdateVariantDetails();
    const updatePrice = useUpdateVariantPrice();
    const updateInventory = useUpdateVariantInventory();
    const updateSku = useUpdateVariantSku();
    const saveStatus = useSaveStatus();

    const [sku, setSku] = React.useState(variant.sku);
    const [price, setPrice] = React.useState(variant.listPrice.toString());
    const [inventory, setInventory] = React.useState(variant.inventory.toString());
    const [options, setOptions] = React.useState<Record<string, string>>(variant.options);

    // Keep a ref to always access the latest variant version
    const variantRef = React.useRef(variant);
    React.useEffect(() => {
        variantRef.current = variant;
    }, [variant]);

    // Track if a save is in progress to prevent concurrent saves
    const isSavingRef = React.useRef(false);

    // Reset form when variant changes
    React.useEffect(() => {
        setSku(variant.sku);
        setPrice(variant.listPrice.toString());
        setInventory(variant.inventory.toString());
        setOptions(variant.options);
    }, [variant.variant_id, variant.version, variant.sku, variant.listPrice, variant.inventory, variant.options]);

    // Auto-save hooks
    const skuAutoSave = useAutoSave(sku, (val) => handleAutoSaveSku(val));
    const optionsAutoSave = useAutoSave(options, (val) => handleAutoSaveOptions(val));
    const priceAutoSave = useAutoSave(price, (val) => handleAutoSavePrice(val));
    const inventoryAutoSave = useAutoSave(inventory, (val) => handleAutoSaveInventory(val));

    const handleAutoSaveOptions = async (value: Record<string, string>) => {
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        if (JSON.stringify(value) === JSON.stringify(currentVariant.options)) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updateDetails.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                options: value,
                expectedVersion: currentVariant.version,
                fulfillmentType: product.productType,
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
        if (isSavingRef.current) return;

        const currentVariant = variantRef.current;
        if (!session?.user?.id || !currentVariant) return;

        const newPrice = parseFloat(value);
        if (isNaN(newPrice) || newPrice === currentVariant.listPrice) return;

        isSavingRef.current = true;
        saveStatus.startSaving();
        try {
            await updatePrice.mutateAsync({
                id: currentVariant.variant_id,
                userId: session.user.id,
                price: newPrice,
                expectedVersion: currentVariant.version,
                fulfillmentType: product.productType,
            });
            saveStatus.completeSave();
        } catch (error) {
            setPrice(currentVariant.listPrice.toString());
            saveStatus.failSave();
            toast.error(
                error instanceof Error ? error.message : "Failed to update price"
            );
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleAutoSaveInventory = async (value: string) => {
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
                fulfillmentType: product.productType,
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

    const handleSkuBlur = () => skuAutoSave.immediateSave();
    const handlePriceBlur = () => priceAutoSave.immediateSave();
    const handleInventoryBlur = () => inventoryAutoSave.immediateSave();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

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

    const hasProductOptions = product.variantOptions && product.variantOptions.length > 0;

    return (
        <div className="space-y-6 pb-6">
            {/* Details Section */}
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
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
                        {product.variantOptions.map((option) => (
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
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
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

            {/* Inventory Section - Only for dropship products */}
            {product.productType !== "digital" && (
                <div className="space-y-4 rounded-lg border border-border/60 p-4">
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
        </div>
    );
}
