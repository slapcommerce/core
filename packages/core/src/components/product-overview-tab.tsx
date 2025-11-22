import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X } from "lucide-react";
import {
  useUpdateProductDetails,
  useUpdateProductClassification,
  useUpdateProductTags,
  useUpdateProductCollections,
  useChangeProductSlug,
  useUpdateProductOptions,
  useUpdateProductFulfillmentType,
} from "@/hooks/use-products";
import { useCollections } from "@/hooks/use-collections";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const updateOptions = useUpdateProductOptions();
  const updateFulfillmentType = useUpdateProductFulfillmentType();
  const { data: collections = [] } = useCollections();
  const saveStatus = useSaveStatus();

  const [title, setTitle] = React.useState(product.title);
  const [shortDescription, setShortDescription] = React.useState(
    product.short_description
  );
  const [slug, setSlug] = React.useState(product.slug);
  const [vendor, setVendor] = React.useState(product.vendor);
  const [fulfillmentType, setFulfillmentType] = React.useState<"digital" | "dropship">(
    product.fulfillment_type === "dropship" ? "dropship" : "digital"
  );
  const [tagsInput, setTagsInput] = React.useState(product.tags.join(", "));
  const [variantOptions, setVariantOptions] = React.useState(product.variant_options || []);
  const [dropshipSafetyBuffer, setDropshipSafetyBuffer] = React.useState(product.dropship_safety_buffer || 0);

  // Auto-save hooks for each field (debounced)
  const titleAutoSave = useAutoSave(title, (val) => handleAutoSaveDetails("title", val));
  const shortDescriptionAutoSave = useAutoSave(shortDescription, (val) => handleAutoSaveDetails("shortDescription", val));
  const vendorAutoSave = useAutoSave(vendor, (val) => handleAutoSaveClassification(val));
  const tagsAutoSave = useAutoSave(tagsInput, () => handleAutoSaveTags());
  const slugAutoSave = useAutoSave(slug, () => handleAutoSaveSlug());
  const optionsAutoSave = useAutoSave(variantOptions, (val) => handleAutoSaveOptions(val));
  const fulfillmentTypeAutoSave = useAutoSave(fulfillmentType, (val) => handleAutoSaveFulfillmentType(val));
  const dropshipBufferAutoSave = useAutoSave(dropshipSafetyBuffer, (val) => handleAutoSaveDropshipBuffer(val));

  // Reset form when product changes
  React.useEffect(() => {
    setTitle(product.title);
    setShortDescription(product.short_description);
    setSlug(product.slug);
    setVendor(product.vendor);
    setFulfillmentType(product.fulfillment_type === "dropship" ? "dropship" : "digital");
    setTagsInput(product.tags.join(", "));
    setVariantOptions(product.variant_options || []);
    setDropshipSafetyBuffer(product.dropship_safety_buffer || 0);
  }, [product.aggregate_id, product.version, product.title, product.short_description, product.slug, product.vendor, product.fulfillment_type, product.tags, product.variant_options, product.dropship_safety_buffer]);

  const handleAutoSaveFulfillmentType = async (val: "digital" | "dropship") => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    if (val === product.fulfillment_type) return;

    saveStatus.startSaving();
    try {
      await updateFulfillmentType.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        fulfillmentType: val,
        // Preserve existing buffer if switching types, though backend might reset it
        dropshipSafetyBuffer: val === "dropship" ? dropshipSafetyBuffer : undefined,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      setFulfillmentType(product.fulfillment_type === "dropship" ? "dropship" : "digital");
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update fulfillment type"
      );
    }
  };

  const handleAutoSaveDropshipBuffer = async (val: number) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    if (val === product.dropship_safety_buffer) return;

    saveStatus.startSaving();
    try {
      await updateFulfillmentType.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        fulfillmentType: "dropship",
        dropshipSafetyBuffer: val,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      setDropshipSafetyBuffer(product.dropship_safety_buffer || 0);
      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update dropship buffer"
      );
    }
  };

  const handleAutoSaveOptions = async (options: typeof variantOptions) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if options actually changed (deep comparison needed or just rely on auto-save trigger)
    // For simplicity, we'll trust the trigger for now, but ideally we should deep compare.
    // Actually, useAutoSave triggers only when value changes, so we are good.

    saveStatus.startSaving();
    try {
      await updateOptions.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        variantOptions: options,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      setVariantOptions(product.variant_options || []);

      saveStatus.failSave();
      toast.error(
        error instanceof Error ? error.message : "Failed to update variant options"
      );
    }
  };

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

  const handleAutoSaveClassification = async (value: string) => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to update products");
      return;
    }

    // Check if value actually changed
    if (value === product.vendor) return;

    saveStatus.startSaving();
    try {
      await updateClassification.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        vendor: value,
        productType: product.product_type,
        expectedVersion: product.version,
      });
      saveStatus.completeSave();
    } catch (error) {
      // Revert to previous value on error
      setVendor(product.vendor);

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

  const handleFulfillmentTypeChange = (value: "digital" | "dropship") => {
    setFulfillmentType(value);
    fulfillmentTypeAutoSave.debouncedSave(value);
  };

  const handleDropshipBufferChange = (value: string) => {
    const numVal = parseInt(value) || 0;
    setDropshipSafetyBuffer(numVal);
    dropshipBufferAutoSave.debouncedSave(numVal);
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
          {fulfillmentType === "dropship" && (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="fulfillmentType">Fulfillment Type</Label>
            <Select
              value={fulfillmentType}
              onValueChange={(val) => handleFulfillmentTypeChange(val as "digital" | "dropship")}
            >
              <SelectTrigger id="fulfillmentType">
                <SelectValue placeholder="Select fulfillment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="dropship">Dropship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fulfillmentType === "dropship" && (
            <div className="space-y-2">
              <Label htmlFor="dropshipBuffer">Dropship Safety Buffer</Label>
              <Input
                id="dropshipBuffer"
                type="number"
                min="0"
                value={dropshipSafetyBuffer}
                onChange={(e) => handleDropshipBufferChange(e.target.value)}
                onBlur={() => dropshipBufferAutoSave.immediateSave()}
              />
              <p className="text-xs text-muted-foreground">
                Buffer to prevent overselling dropship inventory
              </p>
            </div>
          )}
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

      {/* Variant Options Section */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Variant Options</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOptions = [...variantOptions, { name: "", values: [] }];
              setVariantOptions(newOptions);
              // Immediate save for structure change
              handleAutoSaveOptions(newOptions);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Option
          </Button>
        </div>

        <div className="space-y-6">
          {variantOptions.map((option, optionIndex) => (
            <div key={optionIndex} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor={`option-name-${optionIndex}`}>Option Name</Label>
                  <Input
                    id={`option-name-${optionIndex}`}
                    value={option.name}
                    onChange={(e) => {
                      const newOptions = [...variantOptions];
                      if (newOptions[optionIndex]) {
                        newOptions[optionIndex].name = e.target.value;
                        setVariantOptions(newOptions);
                        optionsAutoSave.debouncedSave(newOptions);
                      }
                    }}
                    placeholder="e.g. Size, Color"
                    className="mt-1"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  onClick={() => {
                    const newOptions = variantOptions.filter((_, i) => i !== optionIndex);
                    setVariantOptions(newOptions);
                    handleAutoSaveOptions(newOptions);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Option Values</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {option.values.map((value, valueIndex) => (
                    <Badge key={valueIndex} variant="secondary" className="gap-1 pr-1 py-1 pl-3 text-sm">
                      {value}
                      <button
                        onClick={() => {
                          const newOptions = [...variantOptions];
                          if (newOptions[optionIndex]) {
                            newOptions[optionIndex].values = option.values.filter((_, i) => i !== valueIndex);
                            setVariantOptions(newOptions);
                            handleAutoSaveOptions(newOptions);
                          }
                        }}
                        className="ml-1 rounded-full ring-offset-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove {value}</span>
                      </button>
                    </Badge>
                  ))}
                  {option.values.length === 0 && (
                    <span className="text-sm text-muted-foreground italic self-center">No values added yet.</span>
                  )}
                </div>
                <div className="flex items-center gap-2 max-w-md">
                  <Input
                    placeholder="Add value (e.g. Red, Small)..."
                    className="h-9 text-sm"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && !option.values.includes(val)) {
                        const newOptions = [...variantOptions];
                        if (newOptions[optionIndex]) {
                          newOptions[optionIndex].values = [...option.values, val];
                          setVariantOptions(newOptions);
                          handleAutoSaveOptions(newOptions);
                        }
                        e.target.value = "";
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !option.values.includes(val)) {
                          const newOptions = [...variantOptions];
                          if (newOptions[optionIndex]) {
                            newOptions[optionIndex].values = [...option.values, val];
                            setVariantOptions(newOptions);
                            handleAutoSaveOptions(newOptions);
                          }
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    type="button"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Type a value and press Enter, click "Add", or click away to save.
                </p>
              </div>
            </div>
          ))}
          {variantOptions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No options defined. Add options like "Size" or "Color" to create variants.
            </p>
          )}
        </div>
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
