import { useState } from "react";
import api from "../Services/api";

type CredentialFormProps = {
    vaultId: number;
    onCreated: () => void;
};

function CredentialForm({
    vaultId,
    onCreated
}: CredentialFormProps) {
    const [title, setTitle] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [notes, setNotes] = useState("");

    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState("");

    const getPasswordStrength = (value: string) => {
        if (!value) {
            return {
                label: "",
                score: 0
            };
        }

        let score = 0;

        if (value.length >= 8) score++;
        if (value.length >= 12) score++;
        if (/[A-Z]/.test(value)) score++;
        if (/[a-z]/.test(value)) score++;
        if (/[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;

        if (score <= 2) {
            return {
                label: "Weak",
                score
            };
        }

        if (score <= 4) {
            return {
                label: "Medium",
                score
            };
        }

        return {
            label: "Strong",
            score
        };
    };

    const passwordStrength = getPasswordStrength(password);

    const generatePassword = async () => {
        try {
            setGenerating(true);
            setMessage("");

            const response = await api.post(
                "/security/generate-password",
                {
                    length: 16
                }
            );

            setPassword(response.data.password);
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Failed to generate password"
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            await api.post("/credentials/", {
                vault_id: vaultId,
                title,
                username,
                encrypted_password: password,
                website_url: websiteUrl,
                notes
            });

            setTitle("");
            setUsername("");
            setPassword("");
            setWebsiteUrl("");
            setNotes("");

            setMessage("Credential created successfully!");

            onCreated();
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Failed to create credential"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="credential-form">

            <h3>Create Credential</h3>

            <form onSubmit={handleSubmit}>

                <input
                    type="text"
                    placeholder="Title"
                    value={title}
                    onChange={(e) =>
                        setTitle(e.target.value)
                    }
                    required
                />

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) =>
                        setUsername(e.target.value)
                    }
                    required
                />

                <div className="password-input-group">

                    <input
                        type="text"
                        placeholder="Password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        required
                    />

                    <button
                        type="button"
                        className="generate-btn"
                        onClick={generatePassword}
                        disabled={generating}
                    >
                        {generating
                            ? "Generating..."
                            : "Generate"}
                    </button>

                </div>

                {password && (
                    <div className="password-strength">

                        <div className="strength-header">
                            <span>Password Strength</span>

                            <strong
                                className={`strength-${passwordStrength.label.toLowerCase()}`}
                            >
                                {passwordStrength.label}
                            </strong>
                        </div>

                        <div className="strength-bar">

                            <div
                                className={`strength-fill strength-${passwordStrength.label.toLowerCase()}`}
                                style={{
                                    width:
                                        passwordStrength.label === "Weak"
                                            ? "33%"
                                            : passwordStrength.label === "Medium"
                                                ? "66%"
                                                : "100%"
                                }}
                            />

                        </div>

                    </div>
                )}

                <input
                    type="url"
                    placeholder="Website URL"
                    value={websiteUrl}
                    onChange={(e) =>
                        setWebsiteUrl(e.target.value)
                    }
                />

                <input
                    type="text"
                    placeholder="Notes"
                    value={notes}
                    onChange={(e) =>
                        setNotes(e.target.value)
                    }
                />

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Creating..."
                        : "Create Credential"}
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

export default CredentialForm;