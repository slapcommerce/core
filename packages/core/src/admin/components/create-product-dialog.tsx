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
} from "@/admin/components/ui/dialog";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { Label } from "@/admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import { useCreateProduct } from "@/admin/hooks/use-products";
import { useCollections } from "@/admin/hooks/use-collections";
import { authClient } from "@/admin/lib/auth-client";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProductDialog({
  open,
  onOpenChange,
}: CreateProductDialogProps) {
  const { data: session } = authClient.useSession();
  const { data: collections } = useCollections();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"digital" | "dropship">("digital");
  const [dropshipSafetyBuffer, setDropshipSafetyBuffer] = useState(0);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const createProduct = useCreateProduct();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setCollectionId("");
      setFulfillmentType("digital");
      setDropshipSafetyBuffer(0);
      setSlugManuallyEdited(false);
    }
  }, [open]);

  // Auto-select "Featured" collection if available
  useEffect(() => {
    if (open && collections && !collectionId) {
      const featured = collections.find((c) => c.slug === "featured");
      if (featured) {
        setCollectionId(featured.aggregateId);
      }
    }
  }, [open, collections, collectionId]);

  // Auto-generate slug from name (only if not manually edited)
  useEffect(() => {
    if (name && !slugManuallyEdited) {
      const generatedSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }, [name, slugManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      toast.error("You must be logged in to create products");
      return;
    }

    // Validation
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    if (!collectionId) {
      toast.error("Collection is required");
      return;
    }

    // Validate slug format (URL-friendly)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error(
        "Slug must contain only lowercase letters, numbers, and hyphens",
      );
      return;
    }

    try {
      const id = uuidv7();
      const correlationId = uuidv7();

      await createProduct.mutateAsync({
        id,
        correlationId,
        userId: session.user.id,
        name: name.trim(),
        slug: slug.trim(),
        collections: [collectionId],
        taxable: false,
        description: "",
        richDescriptionUrl: "",
        vendor: "",
        variantOptions: [],
        metaTitle: "",
        metaDescription: "",
        tags: [],
        fulfillmentType,
        dropshipSafetyBuffer: fulfillmentType === "dropship" ? dropshipSafetyBuffer : undefined,
      });

      toast.success(
        "Product created as draft. Add variants and publish when ready.",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create product",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
          <DialogDescription>
            Add a new product to your catalog. You must select a collection.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Awesome Product"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createProduct.isPending}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="slug"
              placeholder="awesome-product"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
              disabled={createProduct.isPending}
              required
              pattern="[a-z0-9-]+"
              title="Slug must contain only lowercase letters, numbers, and hyphens"
            />
            <p className="text-muted-foreground text-xs">
              URL-friendly identifier (auto-generated from name)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection">
              Collection <span className="text-destructive">*</span>
            </Label>
            <Select
              value={collectionId}
              onValueChange={setCollectionId}
              required
              disabled={createProduct.isPending}
            >
              <SelectTrigger id="collection">
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections?.map((collection) => (
                  <SelectItem
                    key={collection.aggregateId}
                    value={collection.aggregateId}
                  >
                    {collection.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fulfillmentType">
              Fulfillment Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={fulfillmentType}
              onValueChange={(val) => setFulfillmentType(val as "digital" | "dropship")}
              required
              disabled={createProduct.isPending}
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
              <Label htmlFor="safetyBuffer">
                Dropship Safety Buffer
              </Label>
              <Input
                id="safetyBuffer"
                type="number"
                min="0"
                value={dropshipSafetyBuffer}
                onChange={(e) => setDropshipSafetyBuffer(parseInt(e.target.value) || 0)}
                disabled={createProduct.isPending}
              />
              <p className="text-muted-foreground text-xs">
                Buffer to prevent overselling dropship inventory
              </p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createProduct.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProduct.isPending}
              className="w-full sm:w-auto"
            >
              {createProduct.isPending ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}
