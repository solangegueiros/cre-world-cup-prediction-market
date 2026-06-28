import { useRead, useMarkets } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { CONTRACT_ADDRESS, MARKET_ABI } from "@/lib/contract";
import { MarketCard } from "@/components/MarketCard";
import { MatchMarkets } from "@/components/MatchMarkets";
import { ContractAddress } from "@/components/ContractAddress";

export function HomePage() {
  const { isConnected } = useWallet();

  const { data: nextMarketId, isLoading, refetch } = useRead<bigint>({
    address: CONTRACT_ADDRESS,
    abi: MARKET_ABI,
    functionName: "nextMarketId",
  });

  const total = Number(nextMarketId ?? 0n);

  // All markets read in one multicall, sorted: Open/Live first, Settled last,
  // then by kickoff time.
  const { markets, isLoading: marketsLoading, refetch: refetchMarkets } = useMarkets(total);

  const { data: testMode } = useRead<boolean>({
    address: CONTRACT_ADDRESS,
    abi: MARKET_ABI,
    functionName: "testMode",
    args: [],
  }, []);

  const refetchAll = () => { refetch(); refetchMarkets(); };

  const showSkeletons = isLoading || (total > 0 && marketsLoading);

  return (
    <div>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Markets</h1>
          <p className="page-subtitle">
            Predict FIFA World Cup match outcomes (non official and study only). Settlements resolved on-chain by Chainlink CRE.
          </p>
        </div>
        <ContractAddress />
      </div>

      {showSkeletons && (
        <div className="grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card skeleton skeleton-card" />
          ))}
        </div>
      )}

      {!showSkeletons && total === 0 && (
        <div className="empty">
          <p className="empty-icon">⚽</p>
          <p className="empty-title">No markets yet.</p>
          <p className="empty-sub">Markets are created by the contract owner for each upcoming match.</p>
        </div>
      )}

      {!showSkeletons && markets.length > 0 && (
        <div className="grid">
          {markets.map((m) => (
            <MarketCard key={m.marketId} market={m} testMode={testMode} />
          ))}
        </div>
      )}

      {isConnected && <MatchMarkets onMarketCreated={refetchAll} />}
    </div>
  );
}
