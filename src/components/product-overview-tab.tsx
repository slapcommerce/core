import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useUpdateProductDetails,
  useUpdateProductClassification,
  useUpdateProductTags,
  useUpdateProductCollections,
  useChangeProductSlug,
} from "@/hooks/use-products";
import { useCollections } from "@/hooks/use-collections";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";

interface ProductOverviewTabProps {
  product: Product;
}

export function ProductOverviewTab({ product }: ProductOverviewTabProps) {
  const { data: session } = authClient.useSession();
  const updateDetails = useUpdateProductDetails();
  const updateClassification = useUpdateProductClassification();
  const updateTags = useUpdateProductTags();
  const updateCollections = useUpdateProductCollections();
  const changeSlug = useChangeProductSlug();
  const { data: collections = [] } = useCollections();

  const [title, setTitle] = React.useState(product.title);
  const [shortDescription, setShortDescription] = React.useState(
    product.short_description
  );
  const [slug, setSlug] = React.useState(product.slug);
  const [vendor, setVendor] = React.useState(product.vendor);
  const [productType, setProductType] = React.useState(product.product_type);
  const [tagsInput, setTagsInput] = React.useState(product.tags.join(", "));

  // Track which fields have unsaved changes
  const [unsavedFields, setUnsavedFields] = React.useState<Set<string>>(
    new Set()
  );

  // Reset form when product changes
  React.useEffect(() => {
    setTitle(product.title);
    setShortDescription(product.short_description);
    setSlug(product.slug);
    setVendor(product.vendor);
    setProductType(product.product_type);
    setTagsInput(product.tags.join(", "));
    setUnsavedFields(new Set());
  }, [product.aggregate_id, product.version]);

  const handleSaveDetails = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    try {
      await updateDetails.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        title,
        shortDescription,
        richDescriptionUrl: "", // TODO: Implement rich description editor
        expectedVersion: product.version,
      });
      setUnsavedFields((prev) => {
        const next = new Set(prev);
        next.delete("title");
        next.delete("shortDescription");
        return next;
      });
      toast.success("Product details updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update details"
      );
    }
  };

  const handleSaveClassification = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    try {
      await updateClassification.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        vendor,
        productType,
        expectedVersion: product.version,
      });
      setUnsavedFields((prev) => {
        const next = new Set(prev);
        next.delete("vendor");
        next.delete("productType");
        return next;
      });
      toast.success("Classification updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update classification"
      );
    }
  };

  const handleSaveTags = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      await updateTags.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        tags,
        expectedVersion: product.version,
      });
      setUnsavedFields((prev) => {
        const next = new Set(prev);
        next.delete("tags");
        return next;
      });
      toast.success("Tags updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update tags"
      );
    }
  };

  const handleSaveSlug = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    try {
      await changeSlug.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        newSlug: slug,
        expectedVersion: product.version,
      });
      setUnsavedFields((prev) => {
        const next = new Set(prev);
        next.delete("slug");
        return next;
      });
      toast.success("Slug updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update slug"
      );
    }
  };

  const hasDetailsChanges =
    title !== product.title || shortDescription !== product.short_description;

  const hasClassificationChanges =
    vendor !== product.vendor || productType !== product.product_type;

  const hasTagsChanges = tagsInput !== product.tags.join(", ");

  const hasSlugChanges = slug !== product.slug;

  return (
    <div className="space-y-6 pb-6">
      {/* Product Details Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Product Details</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setUnsavedFields((prev) => new Set(prev).add("title"));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => {
                setShortDescription(e.target.value);
                setUnsavedFields((prev) => new Set(prev).add("shortDescription"));
              }}
              rows={3}
            />
          </div>

          {hasDetailsChanges && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveDetails}
                disabled={updateDetails.isPending}
              >
                {updateDetails.isPending ? (
                  <>
                    <IconLoader2 className="size-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <IconCheck className="size-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitle(product.title);
                  setShortDescription(product.short_description);
                  setUnsavedFields((prev) => {
                    const next = new Set(prev);
                    next.delete("title");
                    next.delete("shortDescription");
                    return next;
                  });
                }}
              >
                <IconX className="size-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Classification Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Classification</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value);
                setUnsavedFields((prev) => new Set(prev).add("vendor"));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Product Type</Label>
            <Input
              id="productType"
              value={productType}
              onChange={(e) => {
                setProductType(e.target.value);
                setUnsavedFields((prev) => new Set(prev).add("productType"));
              }}
            />
          </div>
        </div>

        {hasClassificationChanges && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveClassification}
              disabled={updateClassification.isPending}
            >
              {updateClassification.isPending ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVendor(product.vendor);
                setProductType(product.product_type);
                setUnsavedFields((prev) => {
                  const next = new Set(prev);
                  next.delete("vendor");
                  next.delete("productType");
                  return next;
                });
              }}
            >
              <IconX className="size-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Slug Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">URL Slug</h3>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setUnsavedFields((prev) => new Set(prev).add("slug"));
            }}
          />
          <p className="text-xs text-muted-foreground">
            Used in the product URL: /products/{slug}
          </p>
        </div>

        {hasSlugChanges && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveSlug}
              disabled={changeSlug.isPending}
            >
              {changeSlug.isPending ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSlug(product.slug);
                setUnsavedFields((prev) => {
                  const next = new Set(prev);
                  next.delete("slug");
                  return next;
                });
              }}
            >
              <IconX className="size-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Tags</h3>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => {
              setTagsInput(e.target.value);
              setUnsavedFields((prev) => new Set(prev).add("tags"));
            }}
            placeholder="e.g. summer, sale, featured"
          />
        </div>

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {hasTagsChanges && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveTags}
              disabled={updateTags.isPending}
            >
              {updateTags.isPending ? (
                <>
                  <IconLoader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTagsInput(product.tags.join(", "));
                setUnsavedFields((prev) => {
                  const next = new Set(prev);
                  next.delete("tags");
                  return next;
                });
              }}
            >
              <IconX className="size-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Collections Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Collections</h3>
        <MultiSelectCombobox
          label="Assign to Collections"
          options={collections.map((c) => ({
            value: c.aggregate_id,
            label: c.title,
          }))}
          value={product.collection_ids}
          onChange={async (collectionIds) => {
            if (!session?.user?.id) {
              toast.error("You must be logged in to update collections");
              return;
            }
            try {
              await updateCollections.mutateAsync({
                id: product.aggregate_id,
                userId: session.user.id,
                collectionIds,
                expectedVersion: product.version,
              });
              toast.success("Collections updated");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to update collections"
              );
            }
          }}
          disabled={updateCollections.isPending}
          placeholder="Select collections..."
        />
        <p className="text-xs text-muted-foreground">
          This product is assigned to {product.collection_ids.length} collection(s)
        </p>
      </div>
    </div>
  );
}
