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

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setProductId(defaultProductId || "");
      setTitle("");
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

    try {
      const id = uuidv7();
      const correlationId = uuidv7();

      await createVariant.mutateAsync({
        id,
        correlationId,
        userId: session.user.id,
        productId,
        title: title.trim(),
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
