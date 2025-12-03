import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import { Checkbox } from "@/admin/components/ui/checkbox";
import { useUpdateProductDownloadSettings } from "@/admin/hooks/use-products";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface ProductDownloadsTabProps {
  product: Product;
}

export function ProductDownloadsTab({ product }: ProductDownloadsTabProps) {
  const { data: session } = authClient.useSession();
  const updateDownloadSettings = useUpdateProductDownloadSettings();
  const saveStatus = useSaveStatus();
  const isSavingRef = React.useRef(false);
  const isDirtyRef = React.useRef(false);

  const [unlimitedDownloads, setUnlimitedDownloads] = React.useState(
    product.maxDownloads === null
  );
  const [maxDownloads, setMaxDownloads] = React.useState(
    product.maxDownloads ?? 5
  );
  const [unlimitedAccess, setUnlimitedAccess] = React.useState(
    product.accessDurationDays === null
  );
  const [accessDurationDays, setAccessDurationDays] = React.useState(
    product.accessDurationDays ?? 30
  );

  // Refs to always have latest values (avoids stale closures in callbacks)
  const unlimitedDownloadsRef = React.useRef(unlimitedDownloads);
  const maxDownloadsRef = React.useRef(maxDownloads);
  const unlimitedAccessRef = React.useRef(unlimitedAccess);
  const accessDurationDaysRef = React.useRef(accessDurationDays);

  // Keep refs updated with latest state
  React.useEffect(() => {
    unlimitedDownloadsRef.current = unlimitedDownloads;
    maxDownloadsRef.current = maxDownloads;
    unlimitedAccessRef.current = unlimitedAccess;
    accessDurationDaysRef.current = accessDurationDays;
  });

  // Auto-save hooks - use refs to avoid stale closure issues
  const maxDownloadsAutoSave = useAutoSave(
    unlimitedDownloads ? null : maxDownloads,
    (val) => handleAutoSave(val, unlimitedAccessRef.current ? null : accessDurationDaysRef.current)
  );
  const accessDurationAutoSave = useAutoSave(
    unlimitedAccess ? null : accessDurationDays,
    (val) => handleAutoSave(unlimitedDownloadsRef.current ? null : maxDownloadsRef.current, val)
  );

  // Reset local state when product changes (but not while dirty or during active save)
  React.useEffect(() => {
    if (isSavingRef.current || isDirtyRef.current) return;

    setUnlimitedDownloads(product.maxDownloads === null);
    setMaxDownloads(product.maxDownloads ?? 5);
    setUnlimitedAccess(product.accessDurationDays === null);
    setAccessDurationDays(product.accessDurationDays ?? 30);
  }, [product.maxDownloads, product.accessDurationDays, product.version]);

  const handleAutoSave = async (
    maxDownloadsVal: number | null,
    accessDurationVal: number | null
  ) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if values actually changed
    if (
      maxDownloadsVal === product.maxDownloads &&
      accessDurationVal === product.accessDurationDays
    ) {
      return;
    }

    isSavingRef.current = true;
    saveStatus.startSaving();
    try {
      await updateDownloadSettings.mutateAsync({
        id: product.aggregateId,
        userId: session.user.id,
        maxDownloads: maxDownloadsVal,
        accessDurationDays: accessDurationVal,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
      isDirtyRef.current = false;
    } catch (error) {
      // Revert on error
      setUnlimitedDownloads(product.maxDownloads === null);
      setMaxDownloads(product.maxDownloads ?? 5);
      setUnlimitedAccess(product.accessDurationDays === null);
      setAccessDurationDays(product.accessDurationDays ?? 30);
      isDirtyRef.current = false;
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update download settings"
      );
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleUnlimitedDownloadsChange = (checked: boolean) => {
    setUnlimitedDownloads(checked);
    isDirtyRef.current = true;
    handleAutoSave(
      checked ? null : maxDownloadsRef.current,
      unlimitedAccessRef.current ? null : accessDurationDaysRef.current
    );
  };

  const handleMaxDownloadsChange = (value: string) => {
    const numVal = parseInt(value) || 0;
    setMaxDownloads(numVal);
    isDirtyRef.current = true;
    maxDownloadsAutoSave.debouncedSave(numVal);
  };

  const handleUnlimitedAccessChange = (checked: boolean) => {
    setUnlimitedAccess(checked);
    isDirtyRef.current = true;
    handleAutoSave(
      unlimitedDownloadsRef.current ? null : maxDownloadsRef.current,
      checked ? null : accessDurationDaysRef.current
    );
  };

  const handleAccessDurationChange = (value: string) => {
    const numVal = parseInt(value) || 0;
    setAccessDurationDays(numVal);
    isDirtyRef.current = true;
    accessDurationAutoSave.debouncedSave(numVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Download Limits Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Download Limits</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="unlimitedDownloads"
              checked={unlimitedDownloads}
              onCheckedChange={(checked) => handleUnlimitedDownloadsChange(checked === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="unlimitedDownloads" className="cursor-pointer">Unlimited Downloads</Label>
              <p className="text-xs text-muted-foreground">
                Allow customers to download the file as many times as they want
              </p>
            </div>
          </div>

          {!unlimitedDownloads && (
            <div className="space-y-2">
              <Label htmlFor="maxDownloads">Maximum Downloads</Label>
              <Input
                id="maxDownloads"
                type="number"
                min="1"
                value={maxDownloads}
                onChange={(e) => handleMaxDownloadsChange(e.target.value)}
                onBlur={() => maxDownloadsAutoSave.immediateSave()}
                onKeyDown={handleKeyDown}
              />
              <p className="text-xs text-muted-foreground">
                Number of times a customer can download after purchase
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Access Duration Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Access Duration</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="unlimitedAccess"
              checked={unlimitedAccess}
              onCheckedChange={(checked) => handleUnlimitedAccessChange(checked === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="unlimitedAccess" className="cursor-pointer">Unlimited Access</Label>
              <p className="text-xs text-muted-foreground">
                Allow customers to access their downloads forever
              </p>
            </div>
          </div>

          {!unlimitedAccess && (
            <div className="space-y-2">
              <Label htmlFor="accessDuration">Access Duration (Days)</Label>
              <Input
                id="accessDuration"
                type="number"
                min="1"
                value={accessDurationDays}
                onChange={(e) => handleAccessDurationChange(e.target.value)}
                onBlur={() => accessDurationAutoSave.immediateSave()}
                onKeyDown={handleKeyDown}
              />
              <p className="text-xs text-muted-foreground">
                Number of days customers can access their downloads after purchase
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4 bg-muted/30">
        <h3 className="text-sm font-semibold">About Digital Downloads</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            These settings apply to all variants of this product. Individual
            variant download files are managed in each variant's settings.
          </p>
          <p>
            <strong>Download Limits:</strong> Restricts how many times a customer
            can download the file. Useful for preventing unauthorized sharing.
          </p>
          <p>
            <strong>Access Duration:</strong> Sets how long customers can access
            their purchase. After this period, download links expire.
          </p>
        </div>
      </div>
    </div>
  );
}
