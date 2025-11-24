import * as React from "react";
import type { Product } from "@/admin/hooks/use-products";
import { Label } from "@/admin/components/ui/label";
import { Input } from "@/admin/components/ui/input";
import { Textarea } from "@/admin/components/ui/textarea";
import { useUpdateProductMetadata } from "@/admin/hooks/use-products";
import { authClient } from "@/admin/lib/auth-client";
import { toast } from "sonner";
import { useSaveStatus } from "@/admin/contexts/save-status-context";
import { useAutoSave } from "@/admin/hooks/use-auto-save";

interface ProductSeoTabProps {
  product: Product;
}

export function ProductSeoTab({ product }: ProductSeoTabProps) {
  const { data: session } = authClient.useSession();
  const updateMetadata = useUpdateProductMetadata();
  const saveStatus = useSaveStatus();

  const [metaTitle, setMetaTitle] = React.useState(product.meta_title);
  const [metaDescription, setMetaDescription] = React.useState(product.meta_description);

  // Auto-save hooks for each field (debounced)
  const metaTitleAutoSave = useAutoSave(metaTitle, (val) => handleAutoSave("metaTitle", val));
  const metaDescriptionAutoSave = useAutoSave(metaDescription, (val) => handleAutoSave("metaDescription", val));

  // Reset local state when product changes
  React.useEffect(() => {
    setMetaTitle(product.meta_title);
    setMetaDescription(product.meta_description);
  }, [product.meta_title, product.meta_description, product.version]);

  const handleAutoSave = async (field: "metaTitle" | "metaDescription", value: string) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update SEO metadata");
      return;
    }

    // Check if value actually changed
    const currentValue = field === "metaTitle" ? product.meta_title : product.meta_description;
    if (value === currentValue) return;

    saveStatus.startSaving();
    try {
      await updateMetadata.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        metaTitle: field === "metaTitle" ? value : metaTitle,
        metaDescription: field === "metaDescription" ? value : metaDescription,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      if (field === "metaTitle") setMetaTitle(product.meta_title);
      if (field === "metaDescription") setMetaDescription(product.meta_description);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update SEO metadata"
      );
    }
  };

  const handleMetaTitleChange = (value: string) => {
    setMetaTitle(value);
    metaTitleAutoSave.debouncedSave(value);
  };

  const handleMetaTitleBlur = () => {
    metaTitleAutoSave.immediateSave();
  };

  const handleMetaTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleMetaDescriptionChange = (value: string) => {
    setMetaDescription(value);
    metaDescriptionAutoSave.debouncedSave(value);
  };

  const handleMetaDescriptionBlur = () => {
    metaDescriptionAutoSave.immediateSave();
  };

  const handleMetaDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* SEO Fields */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Search Engine Optimization</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => handleMetaTitleChange(e.target.value)}
              onBlur={handleMetaTitleBlur}
              onKeyDown={handleMetaTitleKeyDown}
              placeholder="Enter meta title..."
            />
            <p className="text-xs text-muted-foreground">
              Recommended length: 50-60 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={metaDescription}
              onChange={(e) => handleMetaDescriptionChange(e.target.value)}
              onBlur={handleMetaDescriptionBlur}
              onKeyDown={handleMetaDescriptionKeyDown}
              placeholder="Enter meta description..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Recommended length: 150-160 characters
            </p>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Search Engine Preview</h3>

        <div className="space-y-2">
          <div>
            <div className="text-blue-600 text-sm font-medium line-clamp-1">
              {metaTitle || product.title}
            </div>
            <div className="text-green-700 dark:text-green-400 text-xs line-clamp-1">
              https://yourstore.com/products/{product.slug}
            </div>
            <div className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mt-1">
              {metaDescription || product.short_description || "No description provided"}
            </div>
          </div>
        </div>
      </div>

      {/* URL & Slug Info */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">URL Information</h3>

        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Product URL</Label>
            <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md mt-1">
              /products/{product.slug}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
