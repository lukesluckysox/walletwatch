import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface HoldingsData {
  accounts: any[];
  holdings: any[];
  securities: any[];
}

export function useHoldings() {
  return useQuery<HoldingsData>({
    queryKey: ["/api/plaid/holdings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/plaid/holdings");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

export function usePlaidAccounts() {
  return useQuery<any[]>({
    queryKey: ["/api/plaid/accounts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/plaid/accounts");
      return res.json();
    },
    staleTime: 60 * 1000,
    retry: false,
  });
}
