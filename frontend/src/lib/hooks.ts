import { useState, useEffect, useCallback } from "react";
import { type Abi, type WalletClient } from "viem";
import { publicClient } from "./client";
import { CONTRACT_ADDRESS, MARKET_ABI } from "./contract";

// ─── Read ────────────────────────────────────────────────────────────────────

interface ReadConfig {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
  enabled?: boolean;
}

export function useRead<T>(config: ReadConfig, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(config.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (config.enabled === false) return;
    setIsLoading(true);
    try {
      const result = await publicClient.readContract({
        address: config.address,
        abi: config.abi as Abi,
        functionName: config.functionName,
        args: config.args,
      });
      setData(result as T);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.address, config.functionName, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

// ─── matchHasMarket batch (multicall) ───────────────────────────────────────

/** Returns a map of externalMatchId → whether a market already exists for it. */
export function useHasMarkets(ids: number[]) {
  const [map, setMap] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(ids.length > 0);
  const key = ids.join(",");

  const fetch = useCallback(async () => {
    if (ids.length === 0) { setMap({}); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const results = await publicClient.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({
          address: CONTRACT_ADDRESS,
          abi: MARKET_ABI as Abi,
          functionName: "matchHasMarket",
          args: [BigInt(id)],
        })),
      });
      const next: Record<number, boolean> = {};
      ids.forEach((id, i) => {
        const r = results[i];
        next[id] = r.status === "success" ? Boolean(r.result) : false;
      });
      setMap(next);
    } catch {
      // On failure, treat all as not-created so they stay creatable.
      const next: Record<number, boolean> = {};
      ids.forEach((id) => { next[id] = false; });
      setMap(next);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { fetch(); }, [fetch]);

  return { map, isLoading, refetch: fetch };
}

// ─── Markets (multicall + sort) ─────────────────────────────────────────────

export interface MarketData {
  externalMatchId: bigint;
  team1: string;
  team2: string;
  kickoff: bigint;
  settledAfter: bigint;
  status: number; // 0 = Open, 1 = Pending CRE, 2 = Settled
  outcome: number;
  predTotals: readonly bigint[];
  predCounts: readonly bigint[];
}

export interface MarketWithId extends MarketData {
  marketId: number;
}

/**
 * Reads every market (ids 0..total-1) in a single multicall and returns them
 * sorted for the home grid:
 *   1. by status — active markets first (Open, then Pending CRE), Settled last
 *   2. then by kickoff time, soonest first
 */
export function useMarkets(total: number) {
  const [markets, setMarkets] = useState<MarketWithId[]>([]);
  const [isLoading, setIsLoading] = useState(total > 0);

  const fetch = useCallback(async () => {
    if (total === 0) { setMarkets([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const results = await publicClient.multicall({
        allowFailure: true,
        contracts: Array.from({ length: total }, (_, i) => ({
          address: CONTRACT_ADDRESS,
          abi: MARKET_ABI as Abi,
          functionName: "getMarket",
          args: [BigInt(i)],
        })),
      });
      const list: MarketWithId[] = [];
      results.forEach((r, i) => {
        if (r.status === "success" && r.result) {
          const m = r.result as unknown as MarketData;
          list.push({
            ...m,
            marketId: i,
            status: Number(m.status),
            outcome: Number(m.outcome),
          });
        }
      });
      list.sort((a, b) => {
        // Open/Live (0, 1) first, Settled (2) last.
        if (a.status !== b.status) return a.status - b.status;
        // Within a status group, sort by kickoff time:
        //  - Settled (2): newest first  →  kickoff descending
        //  - Active (0, 1): soonest first  →  kickoff ascending
        if (a.kickoff === b.kickoff) return 0;
        const ascending = a.kickoff < b.kickoff ? -1 : 1;
        return a.status === 2 ? -ascending : ascending;
      });
      setMarkets(list);
    } catch {
      setMarkets([]);
    } finally {
      setIsLoading(false);
    }
  }, [total]);

  useEffect(() => { fetch(); }, [fetch]);

  return { markets, isLoading, refetch: fetch };
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export function useBalance(address: `0x${string}` | null, deps: unknown[] = []) {
  const [data, setData] = useState<bigint | undefined>(undefined);

  const fetch = useCallback(async () => {
    if (!address) return;
    const result = await publicClient.getBalance({ address });
    setData(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, refetch: fetch };
}

// ─── Write ───────────────────────────────────────────────────────────────────

interface WriteConfig {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
  value?: bigint; // for payable functions
}

export function useWrite(walletClient: WalletClient | null) {
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = useCallback(
    async (config: WriteConfig): Promise<boolean> => {
      if (!walletClient) return false;
      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      try {
        const hash = await walletClient.writeContract({
          ...(config as any),
          chain: walletClient.chain,
          account: walletClient.account!,
        });
        setIsPending(false);
        setIsConfirming(true);
        await publicClient.waitForTransactionReceipt({ hash });
        setIsConfirming(false);
        setIsSuccess(true);
        return true;
      } catch (e: any) {
        setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
        setIsPending(false);
        setIsConfirming(false);
        return false;
      }
    },
    [walletClient]
  );

  return {
    write,
    isPending,
    isConfirming,
    isSuccess,
    isBusy: isPending || isConfirming,
    error,
    reset: () => setIsSuccess(false),
  };
}
