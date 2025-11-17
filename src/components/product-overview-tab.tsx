import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useSaveStatus } from "@/contexts/save-status-context";
import { useAutoSave } from "@/hooks/use-auto-save";

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
  const saveStatus = useSaveStatus();

  const [title, setTitle] = React.useState(product.title);
  const [shortDescription, setShortDescription] = React.useState(
    product.short_description
  );
  const [slug, setSlug] = React.useState(product.slug);
  const [vendor, setVendor] = React.useState(product.vendor);
  const [productType, setProductType] = React.useState(product.product_type);
  const [tagsInput, setTagsInput] = React.useState(product.tags.join(", "));

  // Auto-save hooks for each field (debounced)
  const titleAutoSave = useAutoSave(title, (val) => handleAutoSaveDetails("title", val));
  const shortDescriptionAutoSave = useAutoSave(shortDescription, (val) => handleAutoSaveDetails("shortDescription", val));
  const vendorAutoSave = useAutoSave(vendor, (val) => handleAutoSaveClassification("vendor", val));
  const productTypeAutoSave = useAutoSave(productType, (val) => handleAutoSaveClassification("productType", val));
  const tagsAutoSave = useAutoSave(tagsInput, () => handleAutoSaveTags());
  const slugAutoSave = useAutoSave(slug, () => handleAutoSaveSlug());

  // Reset form when product changes
  React.useEffect(() => {
    setTitle(product.title);
    setShortDescription(product.short_description);
    setSlug(product.slug);
    setVendor(product.vendor);
    setProductType(product.product_type);
    setTagsInput(product.tags.join(", "));
  }, [product.aggregate_id, product.version, product.title, product.short_description, product.slug, product.vendor, product.product_type, product.tags]);

  const handleAutoSaveDetails = async (field: "title" | "shortDescription", value: string) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if value actually changed
    const currentValue = field === "title" ? product.title : product.short_description;
    if (value === currentValue) return;

    saveStatus.startSaving();
    try {
      await updateDetails.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        title: field === "title" ? value : title,
        shortDescription: field === "shortDescription" ? value : shortDescription,
        richDescriptionUrl: "", // TODO: Implement rich description editor
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      if (field === "title") setTitle(product.title);
      if (field === "shortDescription") setShortDescription(product.short_description);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update details"
      );
    }
  };

  const handleAutoSaveClassification = async (field: "vendor" | "productType", value: string) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if value actually changed
    const currentValue = field === "vendor" ? product.vendor : product.product_type;
    if (value === currentValue) return;

    saveStatus.startSaving();
    try {
      await updateClassification.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        vendor: field === "vendor" ? value : vendor,
        productType: field === "productType" ? value : productType,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      if (field === "vendor") setVendor(product.vendor);
      if (field === "productType") setProductType(product.product_type);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update classification"
      );
    }
  };

  const handleAutoSaveTags = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Check if tags actually changed
    const currentTags = product.tags.join(", ");
    if (tagsInput === currentTags) return;

    saveStatus.startSaving();
    try {
      await updateTags.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        tags,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      setTagsInput(product.tags.join(", "));

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update tags"
      );
    }
  };

  const handleAutoSaveSlug = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if slug actually changed
    if (slug === product.slug) return;

    saveStatus.startSaving();
    try {
      await changeSlug.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        newSlug: slug,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      setSlug(product.slug);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update slug"
      );
    }
  };

  // Blur handlers - immediate save (cancels debounce)
  const handleTitleBlur = () => titleAutoSave.immediateSave();
  const handleShortDescriptionBlur = () => shortDescriptionAutoSave.immediateSave();
  const handleVendorBlur = () => vendorAutoSave.immediateSave();
  const handleProductTypeBlur = () => productTypeAutoSave.immediateSave();
  const handleTagsBlur = () => tagsAutoSave.immediateSave();
  const handleSlugBlur = () => slugAutoSave.immediateSave();

  // Change handlers - debounced save (1000ms after typing stops)
  const handleTitleChange = (value: string) => {
    setTitle(value);
    titleAutoSave.debouncedSave(value);
  };

  const handleShortDescriptionChange = (value: string) => {
    setShortDescription(value);
    shortDescriptionAutoSave.debouncedSave(value);
  };

  const handleVendorChange = (value: string) => {
    setVendor(value);
    vendorAutoSave.debouncedSave(value);
  };

  const handleProductTypeChange = (value: string) => {
    setProductType(value);
    productTypeAutoSave.debouncedSave(value);
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    tagsAutoSave.debouncedSave(value);
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    slugAutoSave.debouncedSave(value);
  };

  // Enter key handlers
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleShortDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleVendorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleProductTypeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleTagsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const handleSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

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
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => handleShortDescriptionChange(e.target.value)}
              onBlur={handleShortDescriptionBlur}
              onKeyDown={handleShortDescriptionKeyDown}
              rows={3}
            />
          </div>
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
              onChange={(e) => handleVendorChange(e.target.value)}
              onBlur={handleVendorBlur}
              onKeyDown={handleVendorKeyDown}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Product Type</Label>
            <Input
              id="productType"
              value={productType}
              onChange={(e) => handleProductTypeChange(e.target.value)}
              onBlur={handleProductTypeBlur}
              onKeyDown={handleProductTypeKeyDown}
            />
          </div>
        </div>
      </div>

      {/* Slug Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">URL Slug</h3>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            onBlur={handleSlugBlur}
            onKeyDown={handleSlugKeyDown}
          />
          <p className="text-xs text-muted-foreground">
            Used in the product URL: /products/{slug}
          </p>
        </div>
      </div>

      {/* Tags Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Tags</h3>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => handleTagsChange(e.target.value)}
            onBlur={handleTagsBlur}
            onKeyDown={handleTagsKeyDown}
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
            saveStatus.startSaving();
            try {
              await updateCollections.mutateAsync({
                id: product.aggregate_id,
                userId: session.user.id,
                collectionIds,
                expectedVersion: product.version,
              });
              saveStatus.completeSave();
            } catch (error) {
              saveStatus.failSave();
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
