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
import { Textarea } from "@/components/ui/textarea";
import { useCreateCollection } from "@/hooks/use-collections";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const createCollection = useCreateCollection();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setDescription("");
      setSlugManuallyEdited(false);
    }
  }, [open]);

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

    // Validation
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    // Validate slug format (URL-friendly)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug must contain only lowercase letters, numbers, and hyphens");
      return;
    }

    try {
      const id = uuidv7();
      const correlationId = uuidv7();

      await createCollection.mutateAsync({
        id,
        correlationId,
        name: name.trim(),
        description: description.trim() || null,
        slug: slug.trim(),
      });

      toast.success("Collection created successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create collection"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Add a new collection to organize your products.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Summer Collection"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createCollection.isPending}
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
              placeholder="summer-collection"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
              disabled={createCollection.isPending}
              required
              pattern="[a-z0-9-]+"
              title="Slug must contain only lowercase letters, numbers, and hyphens"
            />
            <p className="text-muted-foreground text-xs">
              URL-friendly identifier (auto-generated from name)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for this collection"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createCollection.isPending}
              rows={4}
              className="resize-none"
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createCollection.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCollection.isPending}
              className="w-full sm:w-auto"
            >
              {createCollection.isPending ? "Creating..." : "Create Collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

