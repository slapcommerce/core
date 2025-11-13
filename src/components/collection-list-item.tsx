import * as React from "react"
import { useState, useRef, useEffect } from "react"
import {
  IconChevronDown,
  IconChevronRight,
  IconLoader,
  IconArchive,
  IconPhoto,
  IconAlertCircle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { Collection } from "@/hooks/use-collections"
import { useUpdateCollection, useArchiveCollection } from "@/hooks/use-collections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SlugRedirectChain } from "@/components/slug-redirect-chain"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CollectionListItemProps {
  collection: Collection
}

export function CollectionListItem({ collection }: CollectionListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [name, setName] = useState(collection.title)
  const [description, setDescription] = useState(collection.short_description)
  const [slug, setSlug] = useState(collection.slug)
  const [isSaving, setIsSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)

  const updateMutation = useUpdateCollection()
  const archiveMutation = useArchiveCollection()

  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const descriptionTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const slugTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const isArchived = collection.status === "archived"

  // Reset local state when collection prop changes (after successful update)
  useEffect(() => {
    setName(collection.title)
    setDescription(collection.short_description)
    setSlug(collection.slug)
  }, [collection.title, collection.short_description, collection.slug])

  const handleAutoSave = async (field: 'name' | 'description' | 'slug', value: string) => {
    // Don't save if archived
    if (isArchived) return

    // Check if value actually changed
    const currentValue = field === 'name' ? collection.title : field === 'description' ? collection.short_description : collection.slug
    if (value === currentValue) return

    // Validate slug format
    if (field === 'slug') {
      if (!/^[a-z0-9-]+$/.test(value)) {
        setSlugError("Slug must contain only lowercase letters, numbers, and hyphens")
        return
      }
      setSlugError(null)
    }

    setIsSaving(true)
    try {
      await updateMutation.mutateAsync({
        id: collection.collection_id,
        name: field === 'name' ? value : name,
        description: field === 'description' ? (value || null) : (description || null),
        newSlug: field === 'slug' ? value : slug,
        expectedVersion: collection.version,
      })
      // Success is implied - no toast needed
    } catch (error) {
      // Revert to previous value on error
      if (field === 'name') setName(collection.title)
      if (field === 'description') setDescription(collection.short_description)
      if (field === 'slug') setSlug(collection.slug)
      
      toast.error(
        error instanceof Error ? error.message : "Failed to update collection"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
  }

  const handleNameBlur = () => {
    handleAutoSave('name', name)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    if (descriptionTimeoutRef.current) clearTimeout(descriptionTimeoutRef.current)
  }

  const handleDescriptionBlur = () => {
    handleAutoSave('description', description)
  }

  const handleSlugChange = (value: string) => {
    setSlug(value)
    setSlugError(null)
    if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current)
  }

  const handleSlugBlur = () => {
    handleAutoSave('slug', slug)
  }

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      })
      toast.success("Collection archived successfully")
      setShowArchiveDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive collection"
      )
    }
  }

  return (
    <>
      <div
        className={`group relative border-b transition-colors ${
          isArchived ? "opacity-60" : "hover:bg-muted/30"
        }`}
      >
        <div className="flex items-start gap-4 p-4">
          {/* Image Placeholder */}
          <div className="flex-shrink-0">
            <div className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
              <IconPhoto className="size-6 text-muted-foreground/50" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleNameBlur}
                disabled={isArchived || isSaving}
                className="border-transparent bg-transparent text-base font-semibold hover:border-input focus:border-input disabled:opacity-100"
                placeholder="Collection name"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Textarea
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={handleDescriptionBlur}
                disabled={isArchived || isSaving}
                className="border-transparent bg-transparent text-sm text-muted-foreground hover:border-input focus:border-input disabled:opacity-100 resize-none min-h-[60px]"
                placeholder="Add a description..."
                rows={2}
              />
            </div>

            {/* Slug */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Slug:</span>
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={handleSlugBlur}
                  disabled={isArchived || isSaving}
                  className="border-transparent bg-transparent font-mono text-xs text-muted-foreground hover:border-input focus:border-input disabled:opacity-100 h-7 px-2"
                  placeholder="collection-slug"
                />
                {slugError && (
                  <div className="flex items-center gap-1 text-destructive text-xs">
                    <IconAlertCircle className="size-3" />
                    <span>{slugError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Expandable Redirect Chain */}
            {!isArchived && (
              <div className="pt-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  {isExpanded ? (
                    <IconChevronDown className="size-4" />
                  ) : (
                    <IconChevronRight className="size-4" />
                  )}
                  <span>Show redirect history</span>
                </button>
                {isExpanded && (
                  <div className="mt-2 pl-5">
                    <SlugRedirectChain
                      entityId={collection.collection_id}
                      entityType="collection"
                      currentSlug={collection.slug}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-start gap-2">
            {isSaving && (
              <IconLoader className="size-4 text-muted-foreground animate-spin" />
            )}
            <Badge
              variant={collection.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {collection.status}
            </Badge>
            {!isArchived && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => setShowArchiveDialog(true)}
                disabled={archiveMutation.isPending}
              >
                <IconArchive className="size-4" />
                <span className="sr-only">Archive collection</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Collection?</DialogTitle>
            <DialogDescription>
              This will archive "{collection.title}". You can restore it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
              disabled={archiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              variant="destructive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

