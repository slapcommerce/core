import * as React from "react";
import type { Product } from "@/hooks/use-products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDots, IconEdit, IconArchive, IconPackage } from "@tabler/icons-react";
import { usePublishProduct, useArchiveProduct } from "@/hooks/use-products";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

interface ProductListItemProps {
  product: Product;
  onEdit: () => void;
}

export function ProductListItem({ product, onEdit }: ProductListItemProps) {
  const { data: session } = authClient.useSession();
  const publishProduct = usePublishProduct();
  const archiveProduct = useArchiveProduct();

  const handlePublish = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to publish products");
      return;
    }

    try {
      await publishProduct.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        expectedVersion: product.version,
      });
      toast.success("Product published successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish product"
      );
    }
  };

  const handleArchive = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to archive products");
      return;
    }

    try {
      await archiveProduct.mutateAsync({
        id: product.aggregate_id,
        userId: session.user.id,
        expectedVersion: product.version,
      });
      toast.success("Product archived successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive product"
      );
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-base lg:text-lg truncate">
              {product.title}
            </h3>
            <Badge
              variant={
                product.status === "active"
                  ? "default"
                  : product.status === "archived"
                  ? "secondary"
                  : "outline"
              }
            >
              {product.status}
            </Badge>
          </div>

          <div className="space-y-1">
            {product.short_description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {product.short_description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {product.vendor && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Vendor:</span> {product.vendor}
                </span>
              )}
              {product.product_type && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Type:</span> {product.product_type}
                </span>
              )}
              <span className="flex items-center gap-1">
                <IconPackage className="size-3" />
                <span className="font-medium">Collections:</span> {product.collection_ids.length}
              </span>
            </div>

            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="gap-2"
          >
            <IconEdit className="size-4" />
            Edit Details
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <IconDots className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {product.status === "draft" && (
                <DropdownMenuItem onClick={handlePublish}>
                  <IconPackage className="size-4 mr-2" />
                  Publish
                </DropdownMenuItem>
              )}
              {product.status === "active" && (
                <DropdownMenuItem onClick={handleArchive}>
                  <IconArchive className="size-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
