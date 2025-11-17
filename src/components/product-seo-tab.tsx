import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateProductMetadata } from "@/hooks/use-products";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { IconCheck, IconLoader2, IconX, IconInfoCircle } from "@tabler/icons-react";

interface ProductSeoTabProps {
  product: Product;
}

export function ProductSeoTab({ product }: ProductSeoTabProps) {
  const { data: session } = authClient.useSession();
  const updateMetadata = useUpdateProductMetadata();

  // Note: The Product type from productListView doesn't include meta fields
  // We'll need to enhance the view or fetch from another source
  const [metaTitle, setMetaTitle] = React.useState("");
  const [metaDescription, setMetaDescription] = React.useState("");

  const handleSave = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update SEO metadata");
      return;
    }

    try {
      await updateMetadata.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        metaTitle,
        metaDescription,
        expectedVersion: product.version,
      });
      toast.success("SEO metadata updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update SEO metadata"
      );
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <IconInfoCircle className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              SEO View Enhancement Needed
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The current product list view doesn't include SEO metadata fields. To fully
              enable SEO editing, we need to either enhance the product list view or
              create a dedicated product detail query that includes meta_title and
              meta_description.
            </p>
          </div>
        </div>
      </div>

      {/* SEO Fields */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Search Engine Optimization</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
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
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Enter meta description..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Recommended length: 150-160 characters
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={updateMetadata.isPending}>
              {updateMetadata.isPending ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck className="size-4 mr-2" />
                  Save SEO Metadata
                </>
              )}
            </Button>
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
