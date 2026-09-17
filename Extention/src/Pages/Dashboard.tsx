import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../Services/api";
import { useAuth } from "../Context/AuthContext";
import VaultForm from "../Components/VaultForm";
import CredentialForm from "../Components/CredentialForm";
import CredentialItem from "../Components/CredentialItem";
import ChangePassword from "../Components/ChangePassword";

function normalizeWebsite(url: string) {
    if (!url) {
        return "";
    }

    try {
        const parsed = new URL(url);

        return parsed.hostname
            .toLowerCase()
            .replace(/^www\./, "");
    } catch {
        return url
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .trim();
    }
}

function getWebsiteLabel(
    credential: any
) {
    if (credential.website_url) {
        try {
            const parsed = new URL(
                credential.website_url
            );

            return parsed.hostname
                .replace(/^www\./, "");
        } catch {
            return credential.website_url;
        }
    }

    return credential.title || "Other";
}

type DashboardView = "dashboard" | "vaults" | "credentials" | "security" | "settings";

function Dashboard() {
    const { logout } = useAuth();

    const [activeView, setActiveView] =
        useState<DashboardView>("dashboard");

    const [modal, setModal] = useState<
        "vault" | "credential" | "reuse" | null
    >(null);

    const [activeCredentialVault, setActiveCredentialVault] =
        useState<number | null>(null);

    const [expandedSetting, setExpandedSetting] =
        useState<"college" | "autofill" | "pin" | "account" | null>(null);

    const [reuseDetailsOpen, setReuseDetailsOpen] =
        useState(false);

    useEffect(() => {
        if (!modal) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setModal(null);
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [modal]);

    const [health, setHealth] =
        useState<any>(null);

    const [passwordReuse, setPasswordReuse] =
        useState<any>(null);

    const [vaults, setVaults] =
        useState<any[]>([]);

    const [credentials, setCredentials] =
        useState<any[]>([]);

    const [search, setSearch] =
        useState("");

    const [vaultSearch, setVaultSearch] =
        useState("");

    const [
        credentialVaultFilter,
        setCredentialVaultFilter
    ] = useState("");

    const [
        editingVault,
        setEditingVault
    ] = useState<number | null>(null);

    const [vaultName, setVaultName] =
        useState("");

    const [vaultLoading, setVaultLoading] =
        useState(false);

    const [vaultMessage, setVaultMessage] =
        useState("");

    const [logoutLoading, setLogoutLoading] =
        useState(false);

    const [autofillEnabled, setAutofillEnabled] =
        useState(true);

    const [autofillSaving, setAutofillSaving] =
        useState(false);

    const [googleConnected, setGoogleConnected] =
        useState(false);

    const [googleAccountEmail, setGoogleAccountEmail] =
        useState<string | null>(null);

    const [googleLoading, setGoogleLoading] =
        useState(false);

    const [googleMessage, setGoogleMessage] =
        useState("");

    const [pinSet, setPinSet] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [pinMessage, setPinMessage] = useState("");
    const [pinSuccess, setPinSuccess] = useState(false);
    const [pinMode, setPinMode] =
        useState<"set" | "change" | null>(null);
    const [currentPin, setCurrentPin] = useState("");
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");

    useEffect(() => {
        const loadAutofillPreference =
            async () => {
                try {
                    const result =
                        await chrome.storage.local.get(
                            "autofillEnabled"
                        );

                    if (
                        typeof result.autofillEnabled ===
                        "boolean"
                    ) {
                        setAutofillEnabled(
                            result.autofillEnabled
                        );
                    } else {
                        await chrome.storage.local.set({
                            autofillEnabled: true
                        });
                    }
                } catch (error) {
                    console.error(
                        "Failed to load autofill preference",
                        error
                    );
                }
            };

        loadAutofillPreference();
    }, []);

    useEffect(() => {
        const loadGoogleStatus =
            async () => {
                try {
                    const response =
                        await api.get(
                            "/auth/google/status"
                        );

                    setGoogleConnected(
                        Boolean(
                            response.data.connected
                        )
                    );

                    setGoogleAccountEmail(
                        response.data
                            .google_account_email ||
                        null
                    );
                } catch (error) {
                    console.error(
                        "Failed to load Google connection status",
                        error
                    );
                }
            };

        loadGoogleStatus();
    }, []);

    useEffect(() => {
        const loadPinStatus = async () => {
            try {
                const response = await api.get(
                    "/auth/password-view-pin/status"
                );
                setPinSet(Boolean(response.data?.pin_set));
            } catch (error) {
                console.error(
                    "Failed to load password view PIN status",
                    error
                );
            }
        };

        loadPinStatus();
    }, []);

    const resetPinForm = () => {
        setPinMode(null);
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        setPinMessage("");
        setPinSuccess(false);
    };

    const handlePinSubmit = async () => {
        setPinMessage("");
        setPinSuccess(false);

        if (!pinMode) return;

        if (pinMode === "change" && !/^\d{6}$/.test(currentPin)) {
            setPinMessage("Current PIN must be exactly 6 digits.");
            return;
        }

        if (!/^\d{6}$/.test(newPin)) {
            setPinMessage("PIN must be exactly 6 digits.");
            return;
        }

        if (newPin !== confirmPin) {
            setPinMessage("PIN and confirm PIN do not match.");
            return;
        }

        try {
            setPinLoading(true);

            const response = pinMode === "set"
                ? await api.post(
                    "/auth/password-view-pin/set",
                    { pin: newPin }
                )
                : await api.put(
                    "/auth/password-view-pin/change",
                    {
                        current_pin: currentPin,
                        new_pin: newPin
                    }
                );

            setPinSet(true);
            setPinSuccess(true);
            setPinMessage(
                response.data?.message ||
                "Password view PIN updated successfully."
            );
            setCurrentPin("");
            setNewPin("");
            setConfirmPin("");

            setTimeout(() => {
                setPinMode(null);
                setPinMessage("");
            }, 1200);
        } catch (error: any) {
            setPinMessage(
                error.response?.data?.detail ||
                "Failed to update password view PIN."
            );
        } finally {
            setPinLoading(false);
        }
    };

    const handleAutofillToggle =
        async () => {
            if (autofillSaving) {
                return;
            }

            try {
                setAutofillSaving(true);

                const newValue =
                    !autofillEnabled;

                await chrome.storage.local.set({
                    autofillEnabled:
                        newValue
                });

                setAutofillEnabled(
                    newValue
                );
            } catch (error) {
                console.error(
                    "Failed to save autofill preference",
                    error
                );
            } finally {
                setAutofillSaving(false);
            }
        };

    const handleGoogleConnect =
        async () => {
            if (googleLoading) {
                return;
            }

            try {
                setGoogleLoading(true);
                setGoogleMessage("");

                const response =
                    await chrome.runtime.sendMessage({
                        type:
                            "VAULTX_CONNECT_GOOGLE"
                    });

                if (!response?.success) {
                    setGoogleMessage(
                        response?.error ||
                        "Unable to connect Google account."
                    );

                    return;
                }

                setGoogleConnected(true);

                setGoogleAccountEmail(
                    response.googleAccountEmail ||
                    null
                );

                setGoogleMessage(
                    "Google account connected successfully."
                );

            } catch (error) {
                console.error(
                    "Google connection failed",
                    error
                );

                setGoogleMessage(
                    "Unable to connect Google account."
                );
            } finally {
                setGoogleLoading(false);
            }
        };

    const handleGoogleDisconnect =
        async () => {
            if (googleLoading) {
                return;
            }

            try {
                setGoogleLoading(true);
                setGoogleMessage("");

                await api.post(
                    "/auth/google/disconnect"
                );

                setGoogleConnected(false);
                setGoogleAccountEmail(null);

                setGoogleMessage(
                    "Google account disconnected."
                );

            } catch (error: any) {
                console.error(
                    "Google disconnect failed",
                    error
                );

                setGoogleMessage(
                    error.response?.data?.detail ||
                    "Unable to disconnect Google account."
                );
            } finally {
                setGoogleLoading(false);
            }
        };

    const fetchData = useCallback(async (
        nextSearch: string,
        nextVaultFilter: string,
        nextVaultSearch: string
    ) => {
        try {
            const credentialParams =
                new URLSearchParams();

            if (nextSearch.trim()) {
                credentialParams.append(
                    "search",
                    nextSearch.trim()
                );
            }

            if (nextVaultFilter) {
                credentialParams.append(
                    "vault_id",
                    nextVaultFilter
                );
            }

            const credentialQuery =
                credentialParams.toString();

            const [
                healthResponse,
                reuseResponse,
                vaultResponse,
                credentialResponse
            ] = await Promise.all([
                api.get(
                    "/security/password-health"
                ),

                api.get(
                    "/security/password-reuse"
                ),

                api.get(
                    `/vaults/?search=${encodeURIComponent(
                        nextVaultSearch
                    )}`
                ),

                api.get(
                    credentialQuery
                        ? `/credentials/?${credentialQuery}`
                        : "/credentials/"
                )
            ]);

            setHealth(
                healthResponse.data
            );

            setPasswordReuse(
                reuseResponse.data
            );

            setVaults(
                vaultResponse.data.items
            );

            setCredentials(
                credentialResponse.data.items
            );
        } catch (error) {
            console.error(
                "Failed to fetch dashboard data",
                error
            );
        }
    }, []);

    useEffect(() => {
        fetchData("", "", "");
    }, [fetchData]);

    const credentialGroups =
        useMemo(() => {
            const groups = new Map<
                string,
                any[]
            >();

            credentials.forEach(
                (credential) => {
                    const websiteKey =
                        normalizeWebsite(
                            credential.website_url ||
                                credential.title ||
                                `credential-${credential.id}`
                        );

                    const key =
                        websiteKey ||
                        `credential-${credential.id}`;

                    if (!groups.has(key)) {
                        groups.set(key, []);
                    }

                    groups
                        .get(key)!
                        .push(credential);
                }
            );

            return Array.from(
                groups.entries()
            ).map(
                ([key, items]) => ({
                    key,
                    items
                })
            );
        }, [credentials]);

    const handleLogout = async () => {
        if (logoutLoading) {
            return;
        }

        try {
            setLogoutLoading(true);

            await logout();
        } catch (error) {
            console.error(
                "Logout failed",
                error
            );

            setLogoutLoading(false);
        }
    };

    const startEditVault = (
        vault: any
    ) => {
        setEditingVault(vault.id);
        setVaultName(vault.name);
        setVaultMessage("");
    };

    const cancelEditVault = () => {
        setEditingVault(null);
        setVaultName("");
        setVaultMessage("");
    };

    const updateVault = async (
        vaultId: number
    ) => {
        if (!vaultName.trim()) {
            setVaultMessage(
                "Vault name cannot be empty"
            );

            return;
        }

        try {
            setVaultLoading(true);
            setVaultMessage("");

            await api.put(
                `/vaults/${vaultId}`,
                null,
                {
                    params: {
                        name:
                            vaultName.trim()
                    }
                }
            );

            setEditingVault(null);
            setVaultName("");

            await fetchData(search, credentialVaultFilter, vaultSearch);
        } catch (error: any) {
            setVaultMessage(
                error.response?.data
                    ?.detail ||
                    "Failed to update vault"
            );
        } finally {
            setVaultLoading(false);
        }
    };

    const deleteVault = async (
        vaultId: number,
        vaultName: string
    ) => {
        const vault = vaults.find(
            (item) =>
                item.id === vaultId
        );

        if (
            vault &&
            vault.credential_count > 0
        ) {
            alert(
                `Cannot delete vault. It contains ${vault.credential_count} credential(s). Delete the credentials first.`
            );

            return;
        }

        const confirmDelete =
            window.confirm(
                `Are you sure you want to delete "${vaultName}"?`
            );

        if (!confirmDelete) {
            return;
        }

        try {
            await api.delete(
                `/vaults/${vaultId}`
            );

            await fetchData(search, credentialVaultFilter, vaultSearch);
        } catch (error: any) {
            console.error(
                "Failed to delete vault",
                error
            );

            alert(
                error.response?.data
                    ?.detail ||
                    "Failed to delete vault"
            );
        }
    };

    const clearCredentialFilters =
        async () => {
            setSearch("");
            setCredentialVaultFilter("");

            try {
                const response =
                    await api.get(
                        "/credentials/"
                    );

                setCredentials(
                    response.data.items
                );
            } catch {
                console.error(
                    "Failed to clear credential filters"
                );
            }
        };

    const openVault = (vault: any) => {
        if (vault.credential_count > 0) {
            setCredentialVaultFilter(String(vault.id));
            setActiveView("credentials");
            fetchData("", String(vault.id), vaultSearch);
            return;
        }

        setActiveView("vaults");
        setVaultMessage("This vault has no credentials yet. Add one below.");
    };

    const pageContent: Record<DashboardView, { title: string; subtitle: string }> = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Everything important, protected in one place."
        },
        vaults: {
            title: "Vaults",
            subtitle: "Organize your credentials with multiple vaults."
        },
        credentials: {
            title: "Credentials",
            subtitle: "Manage your saved credentials securely."
        },
        security: {
            title: "Security",
            subtitle: "Monitor and enhance your security."
        },
        settings: {
            title: "Settings",
            subtitle: "Customize your VaultX experience."
        }
    };

    return (
        <div className="dashboard">

            <nav className="navbar">

                <div className="navbar-topline">
                    <div className="brand-lockup">
                        <span className="brand-mark">V</span>
                        <div>
                            <h2>VaultX</h2>
                            <small>Personal vault</small>
                        </div>
                    </div>

                    <button
                        className="logout-button"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                    >
                        {logoutLoading ? "..." : "Log out"}
                    </button>
                </div>

                <div className="view-tabs" role="tablist" aria-label="Vault navigation">
                        {([
                            ["dashboard", "Overview"],
                            ["vaults", "Vaults"],
                            ["credentials", "Credentials"],
                            ["security", "Security"],
                            ["settings", "Settings"]
                        ] as [DashboardView, string][]).map(([view, label]) => (
                            <button
                                key={view}
                                className={activeView === view ? "active" : ""}
                                onClick={() => setActiveView(view)}
                                type="button"
                            >
                                {label}
                            </button>
                        ))}
                </div>

            </nav>

            <main className="dashboard-content">

                <div className="dashboard-header">

                    <div>

                        <div>
                            <h1>{pageContent[activeView].title}</h1>
                        </div>

                        <p>
                            {pageContent[activeView].subtitle}
                        </p>

                    </div>

                </div>

                {activeView === "dashboard" && (
                <>
                <section className="overview">

                    <button
                        className="card summary-card"
                        type="button"
                        onClick={() => setActiveView("vaults")}
                    >

                        <span className="stat-icon vault-icon">▣</span>
                        <span>
                            Total Vaults
                        </span>

                        <strong>
                            {vaults.length}
                        </strong>

                    </button>

                    <button
                        className="card summary-card"
                        type="button"
                        onClick={() => setActiveView("credentials")}
                    >

                        <span className="stat-icon credential-icon">▤</span>
                        <span>
                            Total Credentials
                        </span>

                        <strong>
                            {credentials.length}
                        </strong>

                    </button>

                    <button
                        className="card summary-card"
                        type="button"
                        onClick={() => setActiveView("security")}
                    >

                        <span className="stat-icon security-icon">◆</span>
                        <span>
                            Security Score
                        </span>

                        <strong>
                            {health
                                ? health.security_score
                                : 0}
                        </strong>

                    </button>

                </section>

                <section className="overview-actions">
                    <div className="overview-actions-header">
                        <h2>Quick Actions</h2>
                    </div>

                    <button type="button" onClick={() => setModal("vault")}>
                        <span className="action-icon">+</span>
                        <span>Create New Vault</span>
                        <span className="action-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const vault = vaults[0];
                            if (vault) {
                                setActiveCredentialVault(vault.id);
                                setModal("credential");
                            } else {
                                setModal("vault");
                            }
                        }}
                    >
                        <span className="action-icon">+</span>
                        <span>Add Credential</span>
                        <span className="action-arrow">›</span>
                    </button>

                    <button type="button" onClick={() => setActiveView("security")}>
                        <span className="action-icon">◆</span>
                        <span>Security Check</span>
                        <span className="action-arrow">›</span>
                    </button>
                </section>
                </>
                )}

                <section className={`security-section settings-section ${activeView === "settings" ? "" : "view-hidden"} ${expandedSetting === "college" ? "is-expanded" : ""}`}>

                    <button className="setting-heading" type="button" onClick={() => setExpandedSetting(expandedSetting === "college" ? null : "college")}>
                        College Assistant
                        <span>{expandedSetting === "college" ? "−" : "+"}</span>
                    </button>

                    <div className="security-alert">

                        <p>
                            Connect your college Google
                            account so VaultX can securely
                            read OTP emails for the College
                            Assistant.
                        </p>

                        {googleConnected ? (
                            <>
                                <p>
                                    Connected account:{" "}
                                    <strong>
                                        {
                                            googleAccountEmail ||
                                            "Google account"
                                        }
                                    </strong>
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        handleGoogleDisconnect
                                    }
                                    disabled={
                                        googleLoading
                                    }
                                >
                                    {
                                        googleLoading
                                            ? "Disconnecting..."
                                            : "Disconnect Google"
                                    }
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={
                                    handleGoogleConnect
                                }
                                disabled={
                                    googleLoading
                                }
                            >
                                {
                                    googleLoading
                                        ? "Connecting..."
                                        : "Connect Google Account"
                                }
                            </button>
                        )}

                        {googleMessage && (
                            <p className="form-message">
                                {
                                    googleMessage
                                }
                            </p>
                        )}

                    </div>

                </section>

                <section className={`security-section autofill-section ${activeView === "settings" ? "" : "view-hidden"}`}>

                    <h2 className="setting-heading">
                        Autofill Preferences
                    </h2>

                    <div
                        className="security-alert"
                        style={{
                            display: "flex",
                            justifyContent:
                                "space-between",
                            alignItems: "center",
                            gap: "16px"
                        }}
                    >

                        <div>

                            <strong>
                                Enable Autofill
                            </strong>

                            <p>
                                Allow VaultX to detect
                                login pages and offer
                                saved credentials.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={
                                handleAutofillToggle
                            }
                            disabled={
                                autofillSaving
                            }
                            aria-pressed={
                                autofillEnabled
                            }
                        >
                            {
                                autofillEnabled
                                    ? "ON"
                                    : "OFF"
                            }
                        </button>

                    </div>

                </section>

                <section className={`security-section settings-section ${activeView === "settings" ? "" : "view-hidden"} ${expandedSetting === "pin" ? "is-expanded" : ""}`}>

                    <button className="setting-heading" type="button" onClick={() => setExpandedSetting(expandedSetting === "pin" ? null : "pin")}>
                        Password View Security
                        <span>{expandedSetting === "pin" ? "−" : "+"}</span>
                    </button>

                    <div className="security-alert">
                        <strong>Password View PIN</strong>

                        <p>
                            Protect your saved passwords with a 6-digit PIN.
                            The PIN is required whenever you view or edit a saved password.
                        </p>

                        <p>
                            <strong>
                                Status: {pinSet ? "Enabled" : "Not Set"}
                            </strong>
                        </p>

                        {!pinMode && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPinMode(pinSet ? "change" : "set");
                                    setPinMessage("");
                                    setPinSuccess(false);
                                }}
                            >
                                {pinSet ? "Change PIN" : "Set PIN"}
                            </button>
                        )}

                        {pinMode && (
                            <div className="pin-form">
                                <h3>
                                    {pinMode === "set"
                                        ? "Set Password View PIN"
                                        : "Change Password View PIN"}
                                </h3>

                                {pinMode === "change" && (
                                    <label>
                                        Current 6-digit PIN
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="Enter current PIN"
                                            value={currentPin}
                                            onChange={(e) =>
                                                setCurrentPin(
                                                    e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 6)
                                                )
                                            }
                                        />
                                    </label>
                                )}

                                <label>
                                    {pinMode === "set" ? "Create 6-digit PIN" : "New 6-digit PIN"}
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="Enter new PIN"
                                        value={newPin}
                                        onChange={(e) =>
                                            setNewPin(
                                                e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 6)
                                            )
                                        }
                                    />
                                </label>

                                <label>
                                    Confirm 6-digit PIN
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="Re-enter new PIN"
                                        value={confirmPin}
                                        onChange={(e) =>
                                            setConfirmPin(
                                                e.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 6)
                                            )
                                        }
                                    />
                                </label>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        marginTop: "10px"
                                    }}
                                >
                                    <button className="primary-button"
                                        type="button"
                                        onClick={handlePinSubmit}
                                        disabled={pinLoading}
                                    >
                                        {pinLoading
                                            ? "Saving..."
                                            : pinMode === "set"
                                                ? "Update PIN"
                                                : "Update PIN"}
                                    </button>

                                    <button className="secondary-button"
                                        type="button"
                                        onClick={resetPinForm}
                                        disabled={pinLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>

                                {pinMessage && (
                                    <p
                                        className={
                                            pinSuccess
                                                ? "success-message"
                                                : "form-message"
                                        }
                                    >
                                        {pinMessage}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                </section>

                <section className={`security-section settings-section ${activeView === "settings" ? "" : "view-hidden"} ${expandedSetting === "account" ? "is-expanded" : ""}`}>

                    <button className="setting-heading" type="button" onClick={() => setExpandedSetting(expandedSetting === "account" ? null : "account")}>
                        Account Settings
                        <span>{expandedSetting === "account" ? "−" : "+"}</span>
                    </button>

                    <div className="account-settings-content">

                        <ChangePassword />

                    </div>

                </section>

                <section className={`security-section security-view ${activeView === "security" ? "" : "view-hidden"}`}>

                    <h2>
                        Password Security
                    </h2>

                    {health && (
                        <>
                            <div className="security-grid">

                                <div>
                                    <span>
                                        Total
                                    </span>

                                    <strong>
                                        {
                                            health.total_credentials
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Weak
                                    </span>

                                    <strong>
                                        {
                                            health.weak
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Medium
                                    </span>

                                    <strong>
                                        {
                                            health.medium
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Strong
                                    </span>

                                    <strong>
                                        {
                                            health.strong
                                        }
                                    </strong>
                                </div>

                            </div>

                            {health.weak > 0 && (
                                <div className="security-alert warning">

                                    <strong>
                                        ⚠ Security Alert
                                    </strong>

                                    <p>
                                        {
                                            health.weak
                                        }{" "}
                                        weak password
                                        {
                                            health.weak ===
                                            1
                                                ? ""
                                                : "s"
                                        }{" "}
                                        detected.
                                        Consider changing{" "}
                                        {
                                            health.weak ===
                                            1
                                                ? "it"
                                                : "them"
                                        }.
                                    </p>

                                </div>
                            )}

                            {health.weak === 0 && (
                                <div className="security-alert success">

                                    <strong>
                                        ✓ Security Status
                                    </strong>

                                    <p>
                                        All your passwords
                                        are strong.
                                    </p>

                                </div>
                            )}

                        </>
                    )}

                </section>

                <section className={`security-section security-view ${activeView === "security" ? "" : "view-hidden"}`}>

                    <h2>
                        Password Reuse
                    </h2>

                    {passwordReuse && (
                        <>

                            <div className="security-grid">

                                <div>
                                    <span>
                                        Reused Password Groups
                                    </span>

                                    <strong>
                                        {
                                            passwordReuse.reused_password_groups
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Affected Credentials
                                    </span>

                                    <strong>
                                        {
                                            passwordReuse.reused_credentials
                                        }
                                    </strong>
                                </div>

                            </div>

                            {
                                passwordReuse.reused_password_groups ===
                                0
                                    ? (
                                        <div className="success-message">
                                            ✓ No Password Reuse
                                            Detected
                                        </div>
                                    )
                                    : (
                                        <div className="form-message">

                                            <strong>
                                                ⚠ Password reuse
                                                detected
                                            </strong>

                                            <button
                                                className="secondary-button reuse-details-button"
                                                type="button"
                                                onClick={() => setReuseDetailsOpen(!reuseDetailsOpen)}
                                            >
                                                {reuseDetailsOpen ? "Hide details" : "View details"}
                                            </button>

                                            {reuseDetailsOpen && passwordReuse.groups.map(
                                                (
                                                    group: any,
                                                    index: number
                                                ) => (
                                                    <div
                                                        key={index}
                                                        style={{ marginTop: "10px" }}
                                                    >

                                                        <p>
                                                            Same password used in:
                                                        </p>

                                                        {group.credentials.map(
                                                            (credential: any) => (
                                                                <p key={credential.credential_id}>
                                                                    • {credential.title}
                                                                </p>
                                                            )
                                                        )}

                                                    </div>
                                                )
                                            )}

                                        </div>
                                    )
                            }

                        </>
                    )}

                </section>

                <section className={`vault-section ${activeView === "vaults" ? "" : "view-hidden"}`}>

                    <div className="section-header">

                        <h2>
                            Vaults
                        </h2>

                        <div className="section-actions">
                            <span>{vaults.length} total</span>
                            <button className="primary-button compact-button" type="button" onClick={() => setModal("vault")}>
                            + Create Vault
                            </button>
                        </div>

                    </div>

                    <div className="search-box">

                        <input
                            type="text"
                            placeholder="Search vaults..."
                            value={
                                vaultSearch
                            }
                            onChange={(e) =>
                                setVaultSearch(
                                    e.target.value
                                )
                            }
                        />

                        <button
                            onClick={() => fetchData(search, credentialVaultFilter, vaultSearch)}
                        >
                            Search
                        </button>

                    </div>

                    <div className="inline-form-hidden">
                        <VaultForm onCreated={() => fetchData(search, credentialVaultFilter, vaultSearch)} />
                    </div>

                    <div className="vault-list">

                        {vaults.map(
                            (vault) => (
                                <div
                                    className="vault-card"
                                    key={
                                        vault.id
                                    }
                                    onClick={() => openVault(vault)}
                                >

                                    {
                                        editingVault ===
                                        vault.id
                                            ? (
                                                <div className="vault-edit">

                                                    <h3>
                                                        Edit Vault
                                                    </h3>

                                                    <input
                                                        type="text"
                                                        value={
                                                            vaultName
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            setVaultName(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Vault name"
                                                    />

                                                    <div className="vault-actions">

                                                        <button
                                                            onClick={() =>
                                                                updateVault(
                                                                    vault.id
                                                                )
                                                            }
                                                            disabled={
                                                                vaultLoading
                                                            }
                                                        >
                                                            {
                                                                vaultLoading
                                                                    ? "Saving..."
                                                                    : "Save"
                                                            }
                                                        </button>

                                                        <button
                                                            onClick={
                                                                cancelEditVault
                                                            }
                                                            disabled={
                                                                vaultLoading
                                                            }
                                                        >
                                                            Cancel
                                                        </button>

                                                    </div>

                                                    {
                                                        vaultMessage && (
                                                            <p className="form-message">
                                                                {
                                                                    vaultMessage
                                                                }
                                                            </p>
                                                        )
                                                    }

                                                </div>
                                            )
                                            : (
                                                <>
                                                    <div className="vault-header">

                                                        <div>

                                                            <h3>
                                                                {
                                                                    vault.name
                                                                }
                                                            </h3>

                                                            <span className="vault-credential-count">
                                                                {
                                                                    vault.credential_count
                                                                }{" "}
                                                                {
                                                                    vault.credential_count ===
                                                                    1
                                                                        ? "credential"
                                                                        : "credentials"
                                                                }
                                                            </span>

                                                        </div>

                                                        <div className="vault-actions">

                                                            <button
                                                                className="edit-btn"
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    startEditVault(vault);
                                                                }}
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                className="delete-btn"
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    deleteVault(vault.id, vault.name);
                                                                }}
                                                            >
                                                                Delete
                                                            </button>

                                                        </div>

                                                    </div>

                                                    {
                                                        vault.credential_count ===
                                                        0 && (
                                                            <div className="empty-vault-message">

                                                                <strong>
                                                                    No credentials yet.
                                                                </strong>

                                                                <span>
                                                                    Add your first credential below.
                                                                </span>

                                                            </div>
                                                        )
                                                    }

                                                    <button
                                                        className="text-action"
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setActiveCredentialVault(vault.id);
                                                            setModal("credential");
                                                        }}
                                                    >
                                                        + Add credential
                                                    </button>

                                                </>
                                            )
                                    }

                                </div>
                            )
                        )}

                        {
                            vaults.length ===
                            0 && (
                                <p className="empty-message">
                                    No vaults found.
                                </p>
                            )
                        }

                    </div>

                </section>

                <section className={`credentials-section ${activeView === "credentials" ? "" : "view-hidden"}`}>

                    <div className="section-header">

                        <h2>
                            Credentials
                        </h2>

                        <span>
                            {
                                credentialGroups.length
                            }{" "}
                            saved
                        </span>

                        <button className="primary-button compact-button" type="button" onClick={() => {
                            const vault = vaults[0];
                            if (vault) {
                                setActiveCredentialVault(vault.id);
                                setModal("credential");
                            } else {
                                setModal("vault");
                            }
                        }}>
                            + Add Credential
                        </button>

                    </div>

                    <div className="search-box">

                        <input
                            type="text"
                            placeholder="Search credentials..."
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                        />

                        <select
                            value={
                                credentialVaultFilter
                            }
                            onChange={(e) =>
                                setCredentialVaultFilter(
                                    e.target.value
                                )
                            }
                        >

                            <option value="">
                                All Vaults
                            </option>

                            {vaults.map(
                                (vault) => (
                                    <option
                                        key={
                                            vault.id
                                        }
                                        value={
                                            vault.id
                                        }
                                    >
                                        {
                                            vault.name
                                        }
                                    </option>
                                )
                            )}

                        </select>

                        <button
                            onClick={() => fetchData(search, credentialVaultFilter, vaultSearch)}
                        >
                            Search
                        </button>

                        <button
                            onClick={
                                clearCredentialFilters
                            }
                        >
                            Clear
                        </button>

                    </div>

                    <div className="credential-list">

                        {credentialGroups.map(
                            (group) => {

                                const firstCredential =
                                    group.items[0];

                                return (
                                    <div
                                        className="credential-group"
                                        key={
                                            group.key
                                        }
                                        style={{
                                            border:
                                                "1px solid #27272a",
                                            borderRadius:
                                                "14px",
                                            padding:
                                                "12px",
                                            marginBottom:
                                                "16px"
                                        }}
                                    >

                                        <div
                                            style={{
                                                display:
                                                    "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems:
                                                    "center",
                                                marginBottom:
                                                    "10px",
                                                padding:
                                                    "4px 6px"
                                            }}
                                        >

                                            <div>

                                                <h3
                                                    style={{
                                                        margin:
                                                            0
                                                    }}
                                                >
                                                    {
                                                        getWebsiteLabel(
                                                            firstCredential
                                                        )
                                                    }
                                                </h3>

                                                <span
                                                    style={{
                                                        fontSize:
                                                            "12px",
                                                        opacity:
                                                            0.7
                                                    }}
                                                >
                                                    {
                                                        group.items.length
                                                    }{" "}
                                                    {
                                                        group.items.length ===
                                                        1
                                                            ? "account"
                                                            : "accounts"
                                                    }
                                                </span>

                                            </div>

                                            {
                                                group.items.length >
                                                1 && (
                                                    <span
                                                        style={{
                                                            fontSize:
                                                                "12px",
                                                            padding:
                                                                "5px 8px",
                                                            borderRadius:
                                                                "6px",
                                                            background:
                                                                "#27272a"
                                                        }}
                                                    >
                                                        {
                                                            group.items.length
                                                        }{" "}
                                                        accounts
                                                    </span>
                                                )
                                            }

                                        </div>

                                        {
                                            group.items.map(
                                                (
                                                    credential
                                                ) => (
                                                    <CredentialItem
                                                        key={
                                                            credential.id
                                                        }
                                                        credential={
                                                            credential
                                                        }
                                                        onDeleted={
                                                            () => fetchData(search, credentialVaultFilter, vaultSearch)
                                                        }
                                                    />
                                                )
                                            )
                                        }

                                    </div>
                                );
                            }
                        )}

                        {
                            credentialGroups.length ===
                            0 && (
                                <p className="empty-message">
                                    No credentials found.
                                </p>
                            )
                        }

                    </div>

                </section>

            </main>

            {modal && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
                    <div className="modal-card" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <button className="modal-close" type="button" aria-label="Close" onClick={() => setModal(null)}>×</button>
                        {modal === "vault" && <VaultForm onCreated={() => { setModal(null); fetchData(search, credentialVaultFilter, vaultSearch); }} />}
                        {modal === "credential" && activeCredentialVault !== null && (
                            <>
                                <div className="credential-vault-picker">
                                    <label htmlFor="credential-vault-select">
                                        Add to vault
                                    </label>
                                    <select
                                        id="credential-vault-select"
                                        value={activeCredentialVault}
                                        onChange={(event) => setActiveCredentialVault(Number(event.target.value))}
                                    >
                                        {vaults.map((vault) => (
                                            <option key={vault.id} value={vault.id}>
                                                {vault.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <CredentialForm vaultId={activeCredentialVault} onCreated={() => { setModal(null); fetchData(search, credentialVaultFilter, vaultSearch); }} />
                            </>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

export default Dashboard;