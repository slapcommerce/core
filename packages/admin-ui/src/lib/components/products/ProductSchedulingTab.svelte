<script lang="ts">
  import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
  import type { Product } from '$lib/stores/products';

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();
</script>

<div class="space-y-6 pb-6">
  <Card>
    <CardHeader>
      <CardTitle>Scheduling</CardTitle>
      <CardDescription>
        Schedule sales, drops, and other time-based events for this product.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p class="text-sm text-muted-foreground mb-4">
        No scheduled events for this product.
      </p>

      <div class="flex gap-2">
        <Button variant="outline">
          Schedule Sale
        </Button>
        <Button variant="outline">
          Schedule Drop
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
