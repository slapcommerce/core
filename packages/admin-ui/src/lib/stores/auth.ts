import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type User = {
  id: string;
  email: string;
  name: string;
};

export type Session = {
  user: User;
};

type AuthState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    session: null,
    loading: true,
    error: null
  });

  return {
    subscribe,

    async getSession() {
      if (!browser) return;

      update(s => ({ ...s, loading: true, error: null }));

      try {
        const res = await fetch('/api/auth/get-session', {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          // Better Auth returns { session, user } or null
          if (data && data.user) {
            set({ session: { user: data.user }, loading: false, error: null });
          } else {
            set({ session: null, loading: false, error: null });
          }
        } else {
          set({ session: null, loading: false, error: null });
        }
      } catch (err) {
        set({ session: null, loading: false, error: 'Failed to fetch session' });
      }
    },

    async signIn(email: string, password: string) {
      update(s => ({ ...s, loading: true, error: null }));

      try {
        const res = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        if (res.ok) {
          const data = await res.json();
          // Better Auth returns { user, session } on successful sign-in
          if (data && data.user) {
            set({ session: { user: data.user }, loading: false, error: null });
          } else {
            set({ session: null, loading: false, error: 'Invalid response' });
          }
          return true;
        } else {
          const error = await res.json();
          set({ session: null, loading: false, error: error.message || 'Sign in failed' });
          return false;
        }
      } catch (err) {
        set({ session: null, loading: false, error: 'Network error' });
        return false;
      }
    },

    async signUp(email: string, password: string, name: string) {
      update(s => ({ ...s, loading: true, error: null }));

      try {
        const res = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, name })
        });

        if (res.ok) {
          const data = await res.json();
          // Better Auth returns { user, session } on successful sign-up
          if (data && data.user) {
            set({ session: { user: data.user }, loading: false, error: null });
          } else {
            set({ session: null, loading: false, error: 'Invalid response' });
          }
          return true;
        } else {
          const error = await res.json();
          set({ session: null, loading: false, error: error.message || 'Sign up failed' });
          return false;
        }
      } catch (err) {
        set({ session: null, loading: false, error: 'Network error' });
        return false;
      }
    },

    async signOut() {
      try {
        await fetch('/api/auth/sign-out', {
          method: 'POST',
          credentials: 'include'
        });
      } finally {
        set({ session: null, loading: false, error: null });
      }
    },

    clearError() {
      update(s => ({ ...s, error: null }));
    }
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, $auth => !!$auth.session?.user);
export const currentUser = derived(auth, $auth => $auth.session?.user ?? null);
