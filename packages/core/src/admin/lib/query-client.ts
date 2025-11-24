import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0, // Consider data stale immediately to ensure fresh data on hard refresh
            gcTime: 1000 * 60, // Keep unused data in cache for 1 minute (formerly cacheTime)
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: true, // Refetch when component mounts
        },
    },
});
