import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-6 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card relative bg-gradient-to-br from-primary/5 via-card to-card dark:from-primary/10 dark:via-card dark:to-card">
        <CardHeader>
          <CardDescription>Total Revenue</CardDescription>
          <CardTitle
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="gold">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative bg-gradient-to-br from-fantasy-purple/5 via-card to-card dark:from-fantasy-purple/10 dark:via-card dark:to-card">
        <CardHeader>
          <CardDescription>New Customers</CardDescription>
          <CardTitle
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <IconTrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative bg-gradient-to-br from-ornament-gold/5 via-card to-card dark:from-ornament-gold/10 dark:via-card dark:to-card">
        <CardHeader>
          <CardDescription>Active Accounts</CardDescription>
          <CardTitle
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="gold">
              <IconTrendingUp />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong user retention <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative bg-gradient-to-br from-ornament-gold/5 via-card to-card dark:from-ornament-gold/10 dark:via-card dark:to-card">
        <CardHeader>
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="gold">
              <IconTrendingUp />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  );
}
