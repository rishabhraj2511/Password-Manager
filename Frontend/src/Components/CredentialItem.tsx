import { useState } from "react";
import api from "../Services/api";

function CredentialItem({
    credential,
    onDeleted
}: {
    credential: any;
    onDeleted: () => void;
}) {
    const [password, setPassword] = useState("");
    const [revealed, setRevealed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [copied, setCopied] = useState("");

    const [title, setTitle] = useState(credential.title);
    const [username, setUsername] = useState(
        credential.username || ""
    );
    const [websiteUrl, setWebsiteUrl] = useState(
        credential.website_url || ""
    );
    const [notes, setNotes] = useState(
        credential.notes || ""
    );

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

    const revealPassword = async () => {
        try {
            setLoading(true);

            const response = await api.post(
                `/credentials/${credential.id}/reveal`
            );

            setPassword(response.data.password);
            setRevealed(true);

            setTimeout(() => {
                setPassword("");
                setRevealed(false);
            }, 10000);

            return response.data.password;
        } catch (error) {
            console.error("Failed to reveal password");
            return "";
        } finally {
            setLoading(false);
        }
    };

    const startEditing = async () => {
        try {
            setLoading(true);

            const response = await api.post(
                `/credentials/${credential.id}/reveal`
            );

            setPassword(response.data.password);
            setRevealed(false);
            setEditing(true);
        } catch (error) {
            console.error("Failed to load password for editing");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (
        value: string,
        type: string
    ) => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);

            setCopied(type);

            setTimeout(() => {
                setCopied("");
            }, 1500);
        } catch (error) {
            console.error("Failed to copy");
        }
    };

    const updateCredential = async () => {
        try {
            setLoading(true);

            await api.put(
                `/credentials/${credential.id}`,
                {
                    vault_id: credential.vault_id,
                    title,
                    username,
                    encrypted_password: password,
                    website_url: websiteUrl,
                    notes
                }
            );

            setEditing(false);
            setPassword("");

            window.location.reload();
        } catch (error: any) {
            console.error(
                "Failed to update credential",
                error.response?.data || error
            );
        } finally {
            setLoading(false);
        }
    };

    const deleteCredential = async () => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this credential?"
        );

        if (!confirmDelete) return;

        try {
            await api.delete(
                `/credentials/${credential.id}`
            );

            onDeleted();
        } catch (error) {
            console.error("Failed to delete credential");
        }
    };

    if (editing) {
        return (
            <div className="credential-card">

                <div className="edit-header">
                    <h3>Edit Credential</h3>
                </div>

                <div className="edit-form">

                    <input
                        value={title}
                        onChange={(e) =>
                            setTitle(e.target.value)
                        }
                        placeholder="Title"
                    />

                    <input
                        value={username}
                        onChange={(e) =>
                            setUsername(e.target.value)
                        }
                        placeholder="Username"
                    />

                    <div className="password-input-group">

                        <input
                            type="text"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            placeholder="Password"
                        />

                    </div>

                    {password && (
                        <div className="password-strength">

                            <div className="strength-header">

                                <span>
                                    Password Strength
                                </span>

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
                        value={websiteUrl}
                        onChange={(e) =>
                            setWebsiteUrl(e.target.value)
                        }
                        placeholder="Website URL"
                    />

                    <input
                        value={notes}
                        onChange={(e) =>
                            setNotes(e.target.value)
                        }
                        placeholder="Notes"
                    />

                    <div className="credential-actions">

                        <button
                            className="save-btn"
                            onClick={updateCredential}
                            disabled={loading}
                        >
                            {loading
                                ? "Saving..."
                                : "Save"}
                        </button>

                        <button
                            className="cancel-btn"
                            onClick={() => {
                                setEditing(false);
                                setPassword("");
                            }}
                            disabled={loading}
                        >
                            Cancel
                        </button>

                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="credential-card">

            <div className="credential-header">

                <div>
                    <h3>{credential.title}</h3>

                    <span className="credential-label">
                        Password Credential
                    </span>
                </div>

            </div>

            <div className="credential-info">

                <div className="info-row">

                    <span>Username</span>

                    <div className="copy-field">

                        <strong>
                            {credential.username ||
                                "Not provided"}
                        </strong>

                        {credential.username && (
                            <button
                                className="copy-btn"
                                onClick={() =>
                                    copyToClipboard(
                                        credential.username,
                                        "username"
                                    )
                                }
                            >
                                {copied === "username"
                                    ? "Copied!"
                                    : "Copy"}
                            </button>
                        )}

                    </div>

                </div>

                <div className="info-row">

                    <span>Website</span>

                    {credential.website_url ? (
                        <a
                            href={credential.website_url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {credential.website_url}
                        </a>
                    ) : (
                        <strong>
                            Not provided
                        </strong>
                    )}

                </div>

                {credential.notes && (
                    <div className="info-row">

                        <span>Notes</span>

                        <strong>
                            {credential.notes}
                        </strong>

                    </div>
                )}

                {revealed && (
                    <div className="password-box">

                        <span>Password</span>

                        <div className="copy-field">

                            <strong>
                                {password}
                            </strong>

                            <button
                                className="copy-btn"
                                onClick={() =>
                                    copyToClipboard(
                                        password,
                                        "password"
                                    )
                                }
                            >
                                {copied === "password"
                                    ? "Copied!"
                                    : "Copy"}
                            </button>

                        </div>

                        <small>
                            Password will hide automatically
                            after 10 seconds.
                        </small>

                    </div>
                )}

            </div>

            <div className="credential-actions">

                <button
                    className="reveal-btn"
                    onClick={revealPassword}
                    disabled={loading}
                >
                    {loading
                        ? "Revealing..."
                        : revealed
                            ? "Password Revealed"
                            : "Reveal Password"}
                </button>

                <button
                    className="edit-btn"
                    onClick={startEditing}
                    disabled={loading}
                >
                    Edit
                </button>

                <button
                    className="delete-btn"
                    onClick={deleteCredential}
                >
                    Delete
                </button>

            </div>

        </div>
    );
}

export default CredentialItem;