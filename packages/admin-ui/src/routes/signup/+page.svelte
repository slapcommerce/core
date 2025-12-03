<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { auth } from '$lib/stores/auth';
  import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;

    const success = await auth.signUp(email, password, name);

    if (success) {
      goto(`${base}/`);
    }

    loading = false;
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card class="w-full max-w-md">
    <CardHeader class="text-center">
      <div class="mx-auto mb-4">
        <img src="{base}/logo.svg" alt="SlapCommerce" class="h-12 w-auto" />
      </div>
      <CardTitle class="text-2xl">Create an account</CardTitle>
      <CardDescription>Enter your details to get started</CardDescription>
    </CardHeader>
    <form onsubmit={handleSubmit}>
      <CardContent class="space-y-4">
        {#if $auth.error}
          <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {$auth.error}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            bind:value={name}
            required
            disabled={loading}
          />
        </div>

        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
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
            placeholder="Create a password"
            bind:value={password}
            required
            disabled={loading}
          />
        </div>
      </CardContent>
      <CardFooter class="flex-col gap-4">
        <Button type="submit" class="w-full" disabled={loading}>
          {#if loading}
            Creating account...
          {:else}
            Sign up
          {/if}
        </Button>
        <p class="text-sm text-muted-foreground">
          Already have an account?
          <a href="{base}/login" class="text-primary hover:underline">Sign in</a>
        </p>
      </CardFooter>
    </form>
  </Card>
</div>
