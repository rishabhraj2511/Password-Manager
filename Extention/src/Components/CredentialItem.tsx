import { useState } from "react";
import api from "../Services/api";

type PinAction = "reveal" | "edit" | null;

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

    const [title, setTitle] = useState(
        credential.title || ""
    );

    const [username, setUsername] = useState(
        credential.username || ""
    );

    const [websiteUrl, setWebsiteUrl] = useState(
        credential.website_url || ""
    );

    const [notes, setNotes] = useState(
        credential.notes || ""
    );

    // Password-view PIN modal state
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pin, setPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [pinVerifying, setPinVerifying] = useState(false);
    const [pinAction, setPinAction] = useState<PinAction>(null);

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

    const openPinModal = (action: PinAction) => {
        setPinAction(action);
        setPin("");
        setPinError("");
        setPinModalOpen(true);
    };

    const closePinModal = () => {
        if (pinVerifying) return;

        setPinModalOpen(false);
        setPin("");
        setPinError("");
        setPinAction(null);
    };

    const verifyPinAndContinue = async () => {
        if (!/^\d{6}$/.test(pin)) {
            setPinError("Enter exactly 6 digits.");
            return;
        }

        try {
            setPinVerifying(true);
            setPinError("");

            await api.post(
                "/auth/password-view-pin/verify",
                {
                    pin
                }
            );

            const action = pinAction;

            setPinModalOpen(false);
            setPin("");
            setPinAction(null);

            if (action === "reveal") {
                await revealPassword();
            }

            if (action === "edit") {
                await loadPasswordForEditing();
            }
        } catch (error: any) {
            setPinError(
                error.response?.data?.detail ||
                "Incorrect password view PIN."
            );
        } finally {
            setPinVerifying(false);
        }
    };

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
            console.error(
                "Failed to reveal password",
                error
            );

            return "";
        } finally {
            setLoading(false);
        }
    };

    const loadPasswordForEditing = async () => {
        try {
            setLoading(true);

            const response = await api.post(
                `/credentials/${credential.id}/reveal`
            );

            setPassword(response.data.password);
            setRevealed(false);
            setEditing(true);
        } catch (error) {
            console.error(
                "Failed to load password for editing",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    const handleRevealClick = () => {
        if (revealed) {
            setPassword("");
            setRevealed(false);
            return;
        }

        openPinModal("reveal");
    };

    const handleEditClick = () => {
        openPinModal("edit");
    };

    const copyToClipboard = async (
        value: string,
        type: string
    ) => {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);

            setCopied(type);

            setTimeout(() => {
                setCopied("");
            }, 1500);
        } catch (error) {
            console.error(
                "Failed to copy",
                error
            );
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
            `Delete account "${credential.username}"?`
        );

        if (!confirmDelete) {
            return;
        }

        try {
            setLoading(true);

            await api.delete(
                `/credentials/${credential.id}`
            );

            onDeleted();
        } catch (error) {
            console.error(
                "Failed to delete credential",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {editing ? (
                <div
                    className="modal-backdrop credential-edit-modal"
                >
                    <div className="credential-card modal-card">
                        <button
                            className="modal-close"
                            type="button"
                            aria-label="Close edit form"
                            onClick={() => {
                                setEditing(false);
                                setPassword("");
                            }}
                            disabled={loading}
                        >
                            ×
                        </button>

                        <div className="edit-header">
                            <h3>Edit Account</h3>
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
                                                passwordStrength.label ===
                                                "Weak"
                                                    ? "33%"
                                                    : passwordStrength.label ===
                                                        "Medium"
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
                                {loading ? "Saving..." : "Save"}
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
                </div>
            ) : (
                <div
                    className="credential-account-row"
                    style={{
                        padding: "12px 10px",
                        borderTop: "1px solid #27272a",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px"
                        }}
                    >
                        <div
                            style={{
                                minWidth: 0
                            }}
                        >
                            <strong
                                style={{
                                    display: "block",
                                    fontSize: "14px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {credential.username || "No username"}
                            </strong>

                            <span
                                style={{
                                    display: "block",
                                    marginTop: "3px",
                                    fontSize: "11px",
                                    color: "#a1a1aa"
                                }}
                            >
                                {credential.notes || "Saved account"}
                            </span>
                        </div>

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

                    {revealed && (
                        <div
                            className="password-box"
                            style={{
                                marginTop: "2px"
                            }}
                        >
                            <span>Password</span>

                            <div className="copy-field">
                                <strong>{password}</strong>

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

                    <div
                        className="credential-actions"
                        style={{
                            marginTop: "0"
                        }}
                    >
                        <button
                            className="reveal-btn"
                            onClick={handleRevealClick}
                            disabled={loading}
                        >
                            {loading
                                ? "Loading..."
                                : revealed
                                    ? "Hide Password"
                                    : "Reveal Password"}
                        </button>

                        <button
                            className="edit-btn"
                            onClick={handleEditClick}
                            disabled={loading}
                        >
                            Edit
                        </button>

                        <button
                            className="delete-btn"
                            onClick={deleteCredential}
                            disabled={loading}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {pinModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "20px"
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: "360px",
                            background: "#18181b",
                            border: "1px solid #3f3f46",
                            borderRadius: "12px",
                            padding: "24px",
                            boxShadow:
                                "0 20px 50px rgba(0, 0, 0, 0.4)"
                        }}
                    >
                        <h3
                            style={{
                                margin: "0 0 8px",
                                color: "#ffffff"
                            }}
                        >
                            Verify Password View PIN
                        </h3>

                        <p
                            style={{
                                margin: "0 0 18px",
                                color: "#a1a1aa",
                                fontSize: "13px"
                            }}
                        >
                            Enter your 6-digit PIN to{" "}
                            {pinAction === "edit"
                                ? "edit this saved password."
                                : "view this saved password."}
                        </p>

                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            autoFocus
                            value={pin}
                            placeholder="Enter 6-digit PIN"
                            onChange={(e) => {
                                const value =
                                    e.target.value.replace(
                                        /\D/g,
                                        ""
                                    );

                                setPin(value);
                                setPinError("");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    verifyPinAndContinue();
                                }
                            }}
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "12px",
                                borderRadius: "8px",
                                border: "1px solid #52525b",
                                background: "#27272a",
                                color: "#ffffff",
                                fontSize: "18px",
                                letterSpacing: "5px",
                                textAlign: "center",
                                outline: "none"
                            }}
                        />

                        {pinError && (
                            <p
                                style={{
                                    color: "#f87171",
                                    fontSize: "12px",
                                    margin: "10px 0 0"
                                }}
                            >
                                {pinError}
                            </p>
                        )}

                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                marginTop: "20px"
                            }}
                        >
                            <button
                                type="button"
                                onClick={closePinModal}
                                disabled={pinVerifying}
                                style={{
                                    flex: 1,
                                    padding: "11px",
                                    borderRadius: "8px",
                                    border: "1px solid #52525b",
                                    background: "transparent",
                                    color: "#ffffff",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={verifyPinAndContinue}
                                disabled={
                                    pinVerifying ||
                                    pin.length !== 6
                                }
                                style={{
                                    flex: 1,
                                    padding: "11px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: "#6366f1",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                    opacity:
                                        pinVerifying ||
                                        pin.length !== 6
                                            ? 0.6
                                            : 1
                                }}
                            >
                                {pinVerifying
                                    ? "Verifying..."
                                    : "Verify PIN"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default CredentialItem;