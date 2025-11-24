import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { Button } from "@/admin/components/ui/button"

export interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
}

export function Empty({
  className,
  title = "No items found",
  description,
  action,
  icon,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 px-4",
        className
      )}
      {...props}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  )
}

