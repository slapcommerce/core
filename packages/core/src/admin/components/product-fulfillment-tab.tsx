import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import {
  useUpdateProductClassification,
  useUpdateDropshipProductSafetyBuffer,
} from "@/admin/hooks/use-products";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface ProductFulfillmentTabProps {
  product: Product;
}

export function ProductFulfillmentTab({ product }: ProductFulfillmentTabProps) {
  const { data: session } = authClient.useSession();
  const updateClassification = useUpdateProductClassification();
  const updateSafetyBuffer = useUpdateDropshipProductSafetyBuffer();
  const saveStatus = useSaveStatus();

  const [vendor, setVendor] = React.useState(product.vendor);
  const [dropshipSafetyBuffer, setDropshipSafetyBuffer] = React.useState(
    product.dropshipSafetyBuffer || 0
  );

  // Auto-save hooks
  const vendorAutoSave = useAutoSave(vendor, (val) => handleAutoSaveVendor(val));
  const bufferAutoSave = useAutoSave(dropshipSafetyBuffer, (val) =>
    handleAutoSaveBuffer(val)
  );

  // Reset local state when product changes
  React.useEffect(() => {
    setVendor(product.vendor);
    setDropshipSafetyBuffer(product.dropshipSafetyBuffer || 0);
  }, [product.vendor, product.dropshipSafetyBuffer, product.version]);

  const handleAutoSaveVendor = async (value: string) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    if (value === product.vendor) return;

    saveStatus.startSaving();
    try {
      await updateClassification.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        vendor: value,
        expectedVersion: product.version,
        fulfillmentType: product.productType,
      });
      saveStatus.completeSave();
    } catch (error) {
      setVendor(product.vendor);
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update vendor"
      );
    }
  };

  const handleAutoSaveBuffer = async (value: number) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    if (value === product.dropshipSafetyBuffer) return;

    saveStatus.startSaving();
    try {
      await updateSafetyBuffer.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        safetyBuffer: value,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      setDropshipSafetyBuffer(product.dropshipSafetyBuffer || 0);
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update safety buffer"
      );
    }
  };

  const handleVendorChange = (value: string) => {
    setVendor(value);
    vendorAutoSave.debouncedSave(value);
  };

  const handleBufferChange = (value: string) => {
    const numVal = parseInt(value) || 0;
    setDropshipSafetyBuffer(numVal);
    bufferAutoSave.debouncedSave(numVal);
  };

  const handleVendorBlur = () => vendorAutoSave.immediateSave();
  const handleBufferBlur = () => bufferAutoSave.immediateSave();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Vendor Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Supplier Information</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => handleVendorChange(e.target.value)}
              onBlur={handleVendorBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter vendor name..."
            />
            <p className="text-xs text-muted-foreground">
              The supplier or manufacturer of this product
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Settings */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Inventory Settings</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="safetyBuffer">Dropship Safety Buffer</Label>
            <Input
              id="safetyBuffer"
              type="number"
              min="0"
              value={dropshipSafetyBuffer}
              onChange={(e) => handleBufferChange(e.target.value)}
              onBlur={handleBufferBlur}
              onKeyDown={handleKeyDown}
            />
            <p className="text-xs text-muted-foreground">
              Reserve this many units to prevent overselling. The available
              inventory shown to customers will be reduced by this amount.
            </p>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4 bg-muted/30">
        <h3 className="text-sm font-semibold">About Dropship Fulfillment</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Dropship products are fulfilled directly by your supplier. When a
            customer places an order, the order is forwarded to your supplier
            who ships directly to the customer.
          </p>
          <p>
            <strong>Safety Buffer:</strong> Use this to account for inventory
            sync delays between your store and supplier. A buffer of 5 means
            if your supplier has 100 units, customers will only see 95
            available.
          </p>
        </div>
      </div>
    </div>
  );
}
