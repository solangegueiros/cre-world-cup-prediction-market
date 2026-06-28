import { useState } from "react";
import { CopyAddress } from "./CopyAddress";
import { CONTRACT_ADDRESS, setContractAddress } from "@/lib/contract";

export function ContractAddress() {
  const [editing, setEditing] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditAddress(CONTRACT_ADDRESS);
    setEditError(null);
    setEditing(true);
  };

  const handleSave = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(editAddress)) {
      setEditError("Invalid address format");
      return;
    }
    setContractAddress(editAddress);
    // Reload so every contract read picks up the new address.
    window.location.reload();
  };

  const handleCancel = () => {
    setEditing(false);
    setEditError(null);
  };

  return (
    <div className="contract-box">
      <div className="contract-row">
        <span className="label">Contract:</span>
        {editing ? (
          <span className="edit-address">
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="0x..."
            />
            <button className="btn-copy" onClick={handleSave}>Save</button>
            <button className="btn-copy" onClick={handleCancel}>Cancel</button>
          </span>
        ) : (
          <>
            <CopyAddress address={CONTRACT_ADDRESS} />
            <button className="btn-copy" onClick={handleEdit}>Edit</button>
          </>
        )}
      </div>
      {editError && <p className="error">{editError}</p>}
    </div>
  );
}
