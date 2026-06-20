import { Link } from "react-router-dom";
import { useWallet } from "@/lib/wallet";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Header() {
  const { address, isConnected, connect, disconnect } = useWallet();

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width="26" height="26" className="brand-ball" />
          <span>World Cup Prediction Market</span>
        </Link>

        {isConnected ? (
          <div className="wallet">
            <span className="wallet-addr">{shortAddress(address!)}</span>
            <button onClick={disconnect} className="link-btn">
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={connect} className="btn btn-primary btn-sm">
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
