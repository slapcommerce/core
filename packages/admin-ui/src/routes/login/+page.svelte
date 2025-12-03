<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { auth } from '$lib/stores/auth';
  import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;

    const success = await auth.signIn(email, password);

    if (success) {
      goto(`${base}/`);
    }

    loading = false;
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-md shadow-lg">
    <CardHeader class="text-center">
      <div class="mx-auto mb-4">
        <img src="{base}/logo.svg" alt="SlapCommerce" class="h-12 w-auto" />
      </div>
      <CardTitle class="text-2xl">Welcome back</CardTitle>
      <CardDescription>Sign in to your admin account</CardDescription>
    </CardHeader>
    <form onsubmit={handleSubmit}>
      <CardContent class="space-y-4">
        {#if $auth.error}
          <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {$auth.error}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            bind:value={email}
            required
            disabled={loading}
          />
        </div>

        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            required
            disabled={loading}
          />
        </div>
      </CardContent>
      <CardFooter class="flex-col gap-4">
        <Button type="submit" class="w-full" disabled={loading}>
          {#if loading}
            Signing in...
          {:else}
            Sign in
          {/if}
        </Button>
        <p class="text-sm text-muted-foreground">
          Don't have an account?
          <a href="{base}/signup" class="text-primary hover:underline">Sign up</a>
        </p>
      </CardFooter>
    </form>
  </Card>
</div>
