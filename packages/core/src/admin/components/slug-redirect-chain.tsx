import * as React from "react"
import { IconArrowRight, IconLoader } from "@tabler/icons-react"
import { useSlugRedirectChain } from "@/admin/hooks/use-collections"

interface SlugRedirectChainProps {
  aggregateId: string
  aggregateType: 'product' | 'collection'
  currentSlug: string
}

export function SlugRedirectChain({ aggregateId, aggregateType, currentSlug }: SlugRedirectChainProps) {
  const { data: redirects, isPending, isFetching, error } = useSlugRedirectChain(aggregateId, aggregateType)

  // Show loading only when there's no data at all
  if (isPending && !redirects) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <IconLoader className="size-4 animate-spin" />
        <span>Loading redirect history...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive text-sm py-2">
        Failed to load redirect history
      </div>
    )
  }

  if (!redirects || redirects.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-2">
        No redirect history
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-2 transition-opacity duration-200">
      {isFetching && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs animate-in fade-in duration-200">
          <IconLoader className="size-3 animate-spin" />
          <span>Updating...</span>
        </div>
      )}
      <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Redirect History
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {redirects.map((redirect, index) => (
          <React.Fragment key={redirect.slug}>
            <div className="flex items-center gap-2">
              <code className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs font-mono">
                {redirect.slug}
              </code>
              <span className="text-muted-foreground text-xs">
                {new Date(redirect.created_at).toLocaleDateString()}
              </span>
            </div>
            {index < redirects.length && (
              <IconArrowRight className="size-4 text-muted-foreground/50" />
            )}
          </React.Fragment>
        ))}
        <div className="flex items-center gap-2">
          <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono font-semibold">
            {currentSlug}
          </code>
          <span className="text-muted-foreground text-xs">(current)</span>
        </div>
      </div>
    </div>
  )
}

