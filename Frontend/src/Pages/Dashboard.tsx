import { useEffect, useState } from "react";
import api from "../Services/api";
import VaultForm from "../Components/VaultForm";
import CredentialForm from "../Components/CredentialForm";
import CredentialItem from "../Components/CredentialItem";
import ChangePassword from "../Components/ChangePassword";

function Dashboard() {
    const [health, setHealth] = useState<any>(null);
    const [passwordReuse, setPasswordReuse] = useState<any>(null);

    const [vaults, setVaults] = useState<any[]>([]);
    const [credentials, setCredentials] = useState<any[]>([]);

    const [search, setSearch] = useState("");
    const [vaultSearch, setVaultSearch] = useState("");
    const [credentialVaultFilter, setCredentialVaultFilter] = useState("");

    const [editingVault, setEditingVault] = useState<number | null>(null);
    const [vaultName, setVaultName] = useState("");
    const [vaultLoading, setVaultLoading] = useState(false);
    const [vaultMessage, setVaultMessage] = useState("");

    const fetchData = async () => {
        try {
            const credentialParams = new URLSearchParams();

            if (search.trim()) {
                credentialParams.append(
                    "search",
                    search.trim()
                );
            }

            if (credentialVaultFilter) {
                credentialParams.append(
                    "vault_id",
                    credentialVaultFilter
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
                api.get("/security/password-health"),

                api.get("/security/password-reuse"),

                api.get(
                    `/vaults/?search=${encodeURIComponent(
                        vaultSearch
                    )}`
                ),

                api.get(
                    credentialQuery
                        ? `/credentials/?${credentialQuery}`
                        : "/credentials/"
                )
            ]);

            setHealth(healthResponse.data);
            setPasswordReuse(reuseResponse.data);
            setVaults(vaultResponse.data.items);
            setCredentials(
                credentialResponse.data.items
            );

        } catch (error) {
            console.error(
                "Failed to fetch dashboard data",
                error
            );
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const startEditVault = (vault: any) => {
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
                        name: vaultName.trim()
                    }
                }
            );

            setEditingVault(null);
            setVaultName("");

            await fetchData();

        } catch (error: any) {
            setVaultMessage(
                error.response?.data?.detail ||
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
            (item) => item.id === vaultId
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

            await fetchData();

        } catch (error: any) {
            console.error(
                "Failed to delete vault",
                error
            );

            alert(
                error.response?.data?.detail ||
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

            } catch (error) {
                console.error(
                    "Failed to clear credential filters"
                );
            }
        };

    return (
        <div className="dashboard">

            <nav className="navbar">

                <h2>VaultX</h2>

                <div>

                    <span>
                        Dashboard
                    </span>

                    <button
                        onClick={() => {
                            localStorage.removeItem(
                                "token"
                            );

                            window.location.href =
                                "/login";
                        }}
                    >
                        Logout
                    </button>

                </div>

            </nav>

            <main className="dashboard-content">

                <div className="dashboard-header">

                    <div>

                        <h1>
                            Dashboard
                        </h1>

                        <p>
                            Manage your passwords
                            securely.
                        </p>

                    </div>

                </div>

                <section className="overview">

                    <div className="card">

                        <span>
                            Total Vaults
                        </span>

                        <strong>
                            {vaults.length}
                        </strong>

                    </div>

                    <div className="card">

                        <span>
                            Total Credentials
                        </span>

                        <strong>
                            {credentials.length}
                        </strong>

                    </div>

                    <div className="card">

                        <span>
                            Security Score
                        </span>

                        <strong>
                            {health
                                ? health.security_score
                                : 0}
                        </strong>

                    </div>

                </section>

                <section className="security-section">

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
                                        {health.weak}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Medium
                                    </span>

                                    <strong>
                                        {health.medium}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Strong
                                    </span>

                                    <strong>
                                        {health.strong}
                                    </strong>
                                </div>

                            </div>

                            {health.weak > 0 && (
                                <div className="security-alert warning">

                                    <strong>
                                        ⚠ Security Alert
                                    </strong>

                                    <p>
                                        {health.weak} weak password
                                        {health.weak === 1
                                            ? ""
                                            : "s"} detected.
                                        Consider changing{" "}
                                        {health.weak === 1
                                            ? "it"
                                            : "them"}.
                                    </p>

                                </div>
                            )}

                            {health.weak === 0 && (
                                <div className="security-alert success">

                                    <strong>
                                        ✓ Security Status
                                    </strong>

                                    <p>
                                        All your passwords are strong.
                                    </p>

                                </div>
                            )}

                        </>
                    )}

                </section>

                <section className="security-section">

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
                                    ✓ No Password Reuse Detected
                                </div>

                            ) : (

                                <div className="form-message">

                                    <strong>
                                        ⚠ Password reuse detected
                                    </strong>

                                    {passwordReuse.groups.map(
                                        (
                                            group: any,
                                            index: number
                                        ) => (

                                            <div
                                                key={index}
                                                style={{
                                                    marginTop:
                                                        "15px"
                                                }}
                                            >

                                                <p>
                                                    Same password
                                                    used in:
                                                </p>

                                                {
                                                    group.credentials.map(
                                                        (
                                                            credential: any
                                                        ) => (

                                                            <p
                                                                key={
                                                                    credential.credential_id
                                                                }
                                                            >
                                                                •{" "}
                                                                {
                                                                    credential.title
                                                                }
                                                            </p>

                                                        )
                                                    )
                                                }

                                            </div>

                                        )
                                    )}

                                </div>

                            )}

                        </>

                    )}

                </section>

                <ChangePassword />

                <section className="vault-section">

                    <div className="section-header">

                        <h2>
                            Vaults
                        </h2>

                    </div>

                    <div className="search-box">

                        <input
                            type="text"
                            placeholder="Search vaults..."
                            value={vaultSearch}
                            onChange={(e) =>
                                setVaultSearch(
                                    e.target.value
                                )
                            }
                        />

                        <button
                            onClick={fetchData}
                        >
                            Search
                        </button>

                    </div>

                    <VaultForm
                        onCreated={
                            fetchData
                        }
                    />

                    <div className="vault-list">

                        {vaults.map(
                            (vault) => (

                                <div
                                    className="vault-card"
                                    key={vault.id}
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

                                    ) : (

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
                                                        onClick={() =>
                                                            startEditVault(
                                                                vault
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="delete-btn"
                                                        onClick={() =>
                                                            deleteVault(
                                                                vault.id,
                                                                vault.name
                                                            )
                                                        }
                                                    >
                                                        Delete
                                                    </button>

                                                </div>

                                            </div>

                                            {vault.credential_count ===
                                                0 && (

                                                <div className="empty-vault-message">

                                                    <strong>
                                                        No credentials yet.
                                                    </strong>

                                                    <span>
                                                        Add your first credential below.
                                                    </span>

                                                </div>

                                            )}

                                            <CredentialForm
                                                vaultId={
                                                    vault.id
                                                }
                                                onCreated={
                                                    fetchData
                                                }
                                            />

                                        </>

                                    )}

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

                <section className="credentials-section">

                    <div className="section-header">

                        <h2>
                            Credentials
                        </h2>

                        <span>
                            {credentials.length} saved
                        </span>

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
                                        key={vault.id}
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
                            onClick={fetchData}
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

                        {credentials.map(
                            (credential) => (

                                <CredentialItem
                                    key={
                                        credential.id
                                    }
                                    credential={
                                        credential
                                    }
                                    onDeleted={
                                        fetchData
                                    }
                                />

                            )
                        )}

                        {
                            credentials.length ===
                            0 && (

                                <p className="empty-message">
                                    No credentials found.
                                </p>

                            )
                        }

                    </div>

                </section>

            </main>

        </div>
    );
}

export default Dashboard;