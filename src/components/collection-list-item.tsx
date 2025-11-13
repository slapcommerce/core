import * as React from "react"
import { useState, useRef, useEffect } from "react"
import {
  IconLoader,
  IconArchive,
  IconPhoto,
  IconAlertCircle,
  IconDotsVertical,
  IconRoute,
  IconWorld,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { Collection } from "@/hooks/use-collections"
import { useUpdateCollection, useArchiveCollection, usePublishCollection } from "@/hooks/use-collections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SlugRedirectChain } from "@/components/slug-redirect-chain"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  isCardMode?: boolean
}

export function CollectionListItem({ collection, isCardMode = false }: CollectionListItemProps) {
  const [showRedirectDialog, setShowRedirectDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [name, setName] = useState(collection.title)
  const [description, setDescription] = useState(collection.short_description)
  const [slug, setSlug] = useState(collection.slug)
  const [isSaving, setIsSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)

  const updateMutation = useUpdateCollection()
  const archiveMutation = useArchiveCollection()
  const publishMutation = usePublishCollection()

  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const descriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slugTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isArchived = collection.status === "archived"
  const isDraft = collection.status === "draft"
  const isActive = collection.status === "active"

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

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
    // Shift+Enter allows default behavior (newline)
  }

  const handleSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync({
        id: collection.collection_id,
        expectedVersion: collection.version,
      })
      toast.success("Collection published successfully")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish collection"
      )
    }
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
        className={`group relative transition-all duration-200 ${
          !isCardMode ? "border-b" : ""
        } ${
          isArchived 
            ? "opacity-60" 
            : "hover:bg-muted/40 hover:shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-start gap-3 p-3 md:gap-5 md:p-5">
          {/* Mobile: Image + Actions Row */}
          <div className="flex items-start justify-between w-full md:hidden gap-3">
            {/* Image Placeholder */}
            <div className="flex-shrink-0 self-start">
              <div className="flex size-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/60 to-muted/40 transition-all duration-200 group-hover:border-muted-foreground/40 group-hover:from-muted/70 group-hover:to-muted/50">
                <IconPhoto className="size-8 text-muted-foreground/60 transition-colors duration-200 group-hover:text-muted-foreground/70" />
              </div>
            </div>
            {/* Mobile Actions - Badge and Kebab */}
            <div className="flex items-center gap-2 flex-shrink-0 self-start pt-1">
              {isSaving && (
                <IconLoader className="size-4 text-muted-foreground animate-spin transition-opacity duration-200" />
              )}
              <Badge
                variant={
                  isActive 
                    ? "default" 
                    : isDraft 
                    ? "outline" 
                    : "secondary"
                }
                className="capitalize text-xs transition-all duration-200"
              >
                {collection.status}
              </Badge>
              {!isArchived && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                    >
                      <IconDotsVertical className="size-3.5" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isDraft && (
                      <DropdownMenuItem
                        onClick={handlePublish}
                        disabled={publishMutation.isPending}
                      >
                        <IconWorld className="mr-2 size-4" />
                        Publish
                      </DropdownMenuItem>
                    )}
                    {isActive && (
                      <DropdownMenuItem
                        onClick={() => setShowRedirectDialog(true)}
                      >
                        <IconRoute className="mr-2 size-4" />
                        Redirect History
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setShowArchiveDialog(true)}
                      disabled={archiveMutation.isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      <IconArchive className="mr-2 size-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Desktop: Image Placeholder */}
          <div className="hidden md:flex flex-shrink-0 self-start">
            <div className="flex size-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/60 to-muted/40 md:size-40 transition-all duration-200 group-hover:border-muted-foreground/40 group-hover:from-muted/70 group-hover:to-muted/50">
              <IconPhoto className="size-8 text-muted-foreground/60 md:size-12 transition-colors duration-200 group-hover:text-muted-foreground/70" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3 md:space-y-4 w-full md:w-auto">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor={`collection-name-${collection.collection_id}`} className="text-xs md:text-sm text-muted-foreground font-medium ml-0.5 transition-colors duration-200">
                Name
              </Label>
              <Input
                id={`collection-name-${collection.collection_id}`}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                disabled={isArchived || isSaving}
                className="border-input dark:border-input/40 bg-transparent hover:bg-muted/30 hover:border-input dark:hover:border-input/60 focus-visible:bg-muted/20 dark:focus-visible:bg-muted/10 text-sm disabled:opacity-100 md:text-base transition-all duration-200"
                placeholder="Collection name"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor={`collection-description-${collection.collection_id}`} className="text-xs md:text-sm text-muted-foreground font-medium ml-0.5 transition-colors duration-200">
                Description
              </Label>
              <Textarea
                id={`collection-description-${collection.collection_id}`}
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                disabled={isArchived || isSaving}
                className="border-input dark:border-input/40 bg-transparent hover:bg-muted/30 hover:border-input dark:hover:border-input/60 focus-visible:bg-muted/20 dark:focus-visible:bg-muted/10 text-sm text-foreground disabled:opacity-100 resize-none min-h-[50px] md:text-base md:min-h-[60px] transition-all duration-200 leading-relaxed"
                placeholder="Add a description..."
                rows={2}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor={`collection-slug-${collection.collection_id}`} className="text-xs md:text-sm text-muted-foreground font-medium ml-0.5 transition-colors duration-200">
                Slug
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs pointer-events-none transition-colors duration-200">
                    /
                  </span>
                  <Input
                    id={`collection-slug-${collection.collection_id}`}
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    onBlur={handleSlugBlur}
                    onKeyDown={handleSlugKeyDown}
                    disabled={isArchived || isSaving}
                    className="border-input dark:border-input/40 bg-transparent hover:bg-muted/30 hover:border-input dark:hover:border-input/60 focus-visible:bg-muted/20 dark:focus-visible:bg-muted/10 font-mono text-sm text-foreground disabled:opacity-100 md:text-base h-7 pl-6 pr-2 transition-all duration-200"
                    placeholder="collection-slug"
                  />
                </div>
                {slugError && (
                  <div className="flex items-center gap-1 text-destructive text-xs animate-in fade-in duration-200">
                    <IconAlertCircle className="size-3" />
                    <span>{slugError}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0">
            {isSaving && (
              <IconLoader className="size-4 text-muted-foreground animate-spin transition-opacity duration-200" />
            )}
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  isActive 
                    ? "default" 
                    : isDraft 
                    ? "outline" 
                    : "secondary"
                }
                className="capitalize text-xs md:text-sm transition-all duration-200"
              >
                {collection.status}
              </Badge>
              {!isArchived && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted md:size-8 transition-all duration-200"
                    >
                      <IconDotsVertical className="size-3.5 md:size-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isDraft && (
                      <DropdownMenuItem
                        onClick={handlePublish}
                        disabled={publishMutation.isPending}
                      >
                        <IconWorld className="mr-2 size-4" />
                        Publish
                      </DropdownMenuItem>
                    )}
                    {isActive && (
                      <DropdownMenuItem
                        onClick={() => setShowRedirectDialog(true)}
                      >
                        <IconRoute className="mr-2 size-4" />
                        Redirect History
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setShowArchiveDialog(true)}
                      disabled={archiveMutation.isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      <IconArchive className="mr-2 size-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Redirect History Dialog */}
      {isActive && (
        <Dialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Redirect History</DialogTitle>
              <DialogDescription>
                View the slug history for "{collection.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <SlugRedirectChain
                entityId={collection.collection_id}
                entityType="collection"
                currentSlug={collection.slug}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

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

