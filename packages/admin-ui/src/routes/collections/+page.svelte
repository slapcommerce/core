<script lang="ts">
  import { AppLayout } from '$lib/components/layout';
  import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui';
</script>

<AppLayout>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Collections</h1>
      <Button>Create Collection</Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Collections List</CardTitle>
        <CardDescription>Collections module coming soon...</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground">This page will display collections in grid or list view with management capabilities.</p>
      </CardContent>
    </Card>
  </div>
</AppLayout>
