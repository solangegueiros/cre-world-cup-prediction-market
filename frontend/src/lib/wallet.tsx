import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { sepolia } from "viem/chains";

const SEPOLIA_HEX = `0x${sepolia.id.toString(16)}`; // 0xaa36a7

interface WalletContextValue {
  address: `0x${string}` | null;
  walletClient: WalletClient | null;
  chainId: number | null;
  isConnected: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  walletClient: null,
  chainId: null,
  isConnected: false,
  isWrongNetwork: false,
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => {},
});

function buildClient(account: `0x${string}`): WalletClient {
  return createWalletClient({
    account,
    chain: sepolia,
    transport: custom(window.ethereum!),
  });
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // True after an explicit disconnect, so background wallet events don't
  // silently re-connect the app until the user clicks Connect again.
  const disconnectedRef = useRef(false);

  const clear = useCallback(() => {
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
  }, []);

  // Read the current account + chain from the provider and sync state.
  // `requestAccounts` true prompts MetaMask; false reads silently.
  const sync = useCallback(
    async (requestAccounts = false) => {
      if (typeof window === "undefined" || !window.ethereum) return;
      if (disconnectedRef.current && !requestAccounts) return;

      const accounts = (await window.ethereum.request({
        method: requestAccounts ? "eth_requestAccounts" : "eth_accounts",
      })) as `0x${string}`[];

      if (!accounts || accounts.length === 0) {
        clear();
        return;
      }

      const hexChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;

      setAddress(accounts[0]);
      setChainId(parseInt(hexChain, 16));
      setWalletClient(buildClient(accounts[0]));
    },
    [clear]
  );

  // Register provider listeners ONCE — rebuild state on any account/chain
  // change, and clean up on unmount (the old code leaked a listener per
  // connect() call and never reacted to chainChanged).
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const provider = window.ethereum;

    const onAccountsChanged = (accs: `0x${string}`[]) => {
      if (!accs || accs.length === 0) {
        clear();
        return;
      }
      if (disconnectedRef.current) return;
      setAddress(accs[0]);
      setWalletClient(buildClient(accs[0]));
    };

    const onChainChanged = (hexChain: string) => {
      setChainId(parseInt(hexChain, 16));
      // Rebuild the client so it points at the freshly-selected chain.
      if (!disconnectedRef.current && address) setWalletClient(buildClient(address));
    };

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);

    // Silently rehydrate if the site is already authorized.
    sync(false);

    return () => {
      provider.removeListener("accountsChanged", onAccountsChanged);
      provider.removeListener("chainChanged", onChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet.");
      return;
    }
    disconnectedRef.current = false;
    await sync(true);
  }, [sync]);

  const disconnect = useCallback(() => {
    disconnectedRef.current = true;
    clear();
  }, [clear]);

  const switchNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_HEX }],
      });
    } catch (err: any) {
      // 4902 = chain not added to the wallet yet.
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_HEX,
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw err;
      }
    }
    // chainChanged will fire and update state.
  }, []);

  const isConnected = !!address;
  const isWrongNetwork = isConnected && chainId !== null && chainId !== sepolia.id;

  return (
    <WalletContext.Provider
      value={{
        address,
        walletClient,
        chainId,
        isConnected,
        isWrongNetwork,
        connect,
        disconnect,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
