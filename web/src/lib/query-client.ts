import { QueryClient } from "@tanstack/react-query";

/**
 * Factory so we can spin up a fresh client per request on the server
 * (avoids leaking cache between SSR users) while reusing one in the browser.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min — most map/geo data is stable enough
        gcTime: 30 * 60 * 1000, // 30 min retention
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}
