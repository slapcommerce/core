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
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const selectedProduct = products.find((p) => p.aggregate_id === productId);
  const hasOptions = selectedProduct?.variant_options && selectedProduct.variant_options.length > 0;

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProductId(defaultProductId || "");
      setTitle("");
      setSelectedOptions({});
    }
  }, [open, defaultProductId]);

  // Update productId when defaultProductId changes
  useEffect(() => {
    if (defaultProductId) {
      setProductId(defaultProductId);
    }
  }, [defaultProductId]);

  // Reset options when product changes
  useEffect(() => {
    setSelectedOptions({});
    setTitle("");
  }, [productId]);

  // Auto-generate title from options
  useEffect(() => {
    if (hasOptions) {
      const optionValues = selectedProduct.variant_options.map(
        (opt) => selectedOptions[opt.name]
      );
      if (optionValues.every((val) => val)) {
        setTitle(optionValues.join(" / "));
      } else {
        setTitle("");
      }
    }
  }, [selectedOptions, hasOptions, selectedProduct]);

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

    if (hasOptions) {
      const missingOptions = selectedProduct.variant_options.filter(
        (opt) => !selectedOptions[opt.name]
      );
      if (missingOptions.length > 0) {
        toast.error(`Please select ${missingOptions.map((o) => o.name).join(", ")}`);
        return;
      }
    } else if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      const id = uuidv7();
      const correlationId = uuidv7();

      await createVariant.mutateAsync({
        id,
        correlationId,
        userId: session.user.id,
        productId,
        title: title.trim(),
        options: hasOptions ? selectedOptions : undefined,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Variant</DialogTitle>
          <DialogDescription>
            Create a new variant draft. You can add pricing, inventory, and other details later.
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

          {/* Dynamic Options or Title */}
          {hasOptions ? (
            <div className="space-y-4">
              {selectedProduct.variant_options.map((option) => (
                <div key={option.name} className="space-y-2">
                  <Label>
                    {option.name} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedOptions[option.name] || ""}
                    onValueChange={(value) =>
                      setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))
                    }
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
              <div className="pt-2">
                <Label>Generated Title</Label>
                <div className="mt-1 text-sm text-muted-foreground">
                  {title || "Select options to generate title"}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="title">
                Variant Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Large / Blue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={createVariant.isPending || !productId}
                required
                autoFocus={!!defaultProductId}
              />
            </div>
          )}

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
