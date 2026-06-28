import { useState } from "react";

interface Props {
  address: string;
}

export function CopyAddress({ address }: Props) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="address-inline">
      <code>{address}</code>
      <button className="btn-copy" onClick={copyAddress}>{copied ? "Copied!" : "Copy"}</button>
    </span>
  );
}
