import { useState } from "react";
import api from "../Services/api";

type VaultFormProps = {
    onCreated: () => void;
};

function VaultForm({ onCreated }: VaultFormProps) {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setMessage("Vault name is required");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            await api.post("/vaults/", null, {
                params: {
                    name: name.trim()
                }
            });

            setName("");
            setMessage("Vault created successfully!");

            onCreated();
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Failed to create vault"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-box">

            <h3>Create Vault</h3>

            <form onSubmit={handleSubmit}>

                <input
                    type="text"
                    placeholder="Vault name"
                    value={name}
                    onChange={(e) =>
                        setName(e.target.value)
                    }
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Creating..."
                        : "Create Vault"}
                </button>

            </form>

            {message && (
                <p className="form-message">
                    {message}
                </p>
            )}

        </div>
    );
}

export default VaultForm;