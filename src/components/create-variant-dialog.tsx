import * as React from "react";
import { useState, useEffect } from "react";
import { uuidv7 } from "uuidv7";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateVariant } from "@/hooks/use-variants";
import { useProducts } from "@/hooks/use-products";
import { authClient } from "@/lib/auth-client";

interface CreateVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProductId?: string;
}

export function CreateVariantDialog({
  open,
  onOpenChange,
  defaultProductId,
}: CreateVariantDialogProps) {
  const { data: session } = authClient.useSession();
  const { data: products = [] } = useProducts();
  const createVariant = useCreateVariant();

  const [productId, setProductId] = useState(defaultProductId || "");
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("0");
  const [optionsInput, setOptionsInput] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weight, setWeight] = useState("");

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProductId(defaultProductId || "");
      setTitle("");
      setSku("");
      setPrice("");
      setInventory("0");
      setOptionsInput("");
      setBarcode("");
      setWeight("");
    }
  }, [open, defaultProductId]);

  // Update productId when defaultProductId changes
  useEffect(() => {
    if (defaultProductId) {
      setProductId(defaultProductId);
    }
  }, [defaultProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      toast.error("You must be logged in to create variants");
      return;
    }

    // Validation
    if (!productId) {
      toast.error("Product is required");
      return;
    }

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!sku.trim()) {
      toast.error("SKU is required");
      return;
    }

    if (!price || parseFloat(price) < 0) {
      toast.error("Valid price is required");
      return;
    }

    if (!inventory || parseInt(inventory, 10) < 0) {
      toast.error("Valid inventory count is required");
      return;
    }

    // Parse options
    const options: Record<string, string> = {};
    if (optionsInput.trim()) {
      optionsInput.split(",").forEach((pair) => {
        const [key, value] = pair.split(":").map((s) => s.trim());
        if (key && value) {
          options[key] = value;
        }
      });
    }

    try {
      const id = uuidv7();
      const correlationId = uuidv7();

      await createVariant.mutateAsync({
        id,
        correlationId,
        userId: session.user.id,
        productId,
        sku: sku.trim(),
        title: title.trim(),
        price: parseFloat(price),
        inventory: parseInt(inventory, 10),
        options,
        barcode: barcode.trim() || null,
        weight: weight.trim() ? parseFloat(weight) : null,
      });

      toast.success("Variant created successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create variant"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Variant</DialogTitle>
          <DialogDescription>
            Add a new variant to a product. Set pricing, inventory, and options.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Selector */}
          {!defaultProductId && (
            <div className="space-y-2">
              <Label htmlFor="product">
                Product <span className="text-destructive">*</span>
              </Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.aggregate_id} value={product.aggregate_id}>
                      {product.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Variant Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Large / Blue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createVariant.isPending}
              required
              autoFocus={!!defaultProductId}
            />
          </div>

          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sku"
              placeholder="e.g., PROD-001-LG-BLU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={createVariant.isPending}
              required
            />
          </div>

          {/* Price and Inventory Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">
                Price ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={createVariant.isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory">
                Inventory <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inventory"
                type="number"
                placeholder="0"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                disabled={createVariant.isPending}
                required
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label htmlFor="options">Options</Label>
            <Input
              id="options"
              placeholder="Size: Large, Color: Blue"
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              disabled={createVariant.isPending}
            />
            <p className="text-muted-foreground text-xs">
              Format: Key: Value, separated by commas
            </p>
          </div>

          {/* Barcode and Weight Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                placeholder="Optional"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={createVariant.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight (oz)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                placeholder="Optional"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={createVariant.isPending}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createVariant.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createVariant.isPending}
              className="w-full sm:w-auto"
            >
              {createVariant.isPending ? "Creating..." : "Create Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
