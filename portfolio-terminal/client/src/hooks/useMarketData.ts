import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useMarketData(key?: string) {
  return useQuery<any>({
    queryKey: key ? ["/api/market", key] : ["/api/market"],
    queryFn: async () => {
      const url = key ? `/api/market/${key}` : "/api/market";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
