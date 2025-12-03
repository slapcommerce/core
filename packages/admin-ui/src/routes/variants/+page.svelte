<script lang="ts">
  import { AppLayout } from '$lib/components/layout';
  import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
</script>

<AppLayout>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Variants</h1>
      <Button>Create Variant</Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Variants List</CardTitle>
        <CardDescription>Variants module coming soon...</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground">This page will display product variants with management capabilities.</p>
      </CardContent>
    </Card>
  </div>
</AppLayout>
