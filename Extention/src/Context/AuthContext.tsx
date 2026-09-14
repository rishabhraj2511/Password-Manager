import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from "react";

type AuthContextType = {
    token: string | null;
    isLoggedIn: boolean;
    loading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext =
    createContext<AuthContextType | undefined>(
        undefined
    );

export function AuthProvider({
    children
}: {
    children: ReactNode;
}) {
    const [token, setToken] =
        useState<string | null>(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        let expiryTimer: ReturnType<
            typeof setTimeout
        > | null = null;

        const clearSession = async () => {
            if (expiryTimer) {
                clearTimeout(expiryTimer);
                expiryTimer = null;
            }

            await chrome.storage.local.remove(
                "token"
            );

            setToken(null);
        };

        const restoreSession = async () => {
            try {
                const result =
                    await chrome.storage.local.get(
                        "token"
                    );

                const storedToken =
                    typeof result.token === "string"
                        ? result.token
                        : null;

                if (!storedToken) {
                    setToken(null);
                    return;
                }

                try {
                    const parts =
                        storedToken.split(".");

                    if (parts.length !== 3) {
                        await clearSession();
                        return;
                    }

                    const payload =
                        JSON.parse(
                            atob(
                                parts[1]
                                    .replace(/-/g, "+")
                                    .replace(/_/g, "/")
                            )
                        );

                    const expiry =
                        typeof payload.exp === "number"
                            ? payload.exp * 1000
                            : 0;

                    if (
                        !expiry ||
                        Date.now() >= expiry
                    ) {
                        await clearSession();
                        return;
                    }

                    setToken(storedToken);

                    const remainingTime =
                        expiry - Date.now();

                    expiryTimer = setTimeout(
                        () => {
                            clearSession();
                        },
                        remainingTime
                    );

                } catch (error) {
                    console.error(
                        "Invalid authentication token",
                        error
                    );

                    await clearSession();
                }

            } catch (error) {
                console.error(
                    "Failed to restore session",
                    error
                );
            } finally {
                setLoading(false);
            }
        };

        restoreSession();

        return () => {
            if (expiryTimer) {
                clearTimeout(expiryTimer);
            }
        };
    }, []);

    const login = async (
        newToken: string
    ) => {
        if (!newToken) {
            return;
        }

        await chrome.storage.local.set({
            token: newToken
        });

        setToken(newToken);
    };

    const logout = async () => {
        await chrome.storage.local.remove(
            "token"
        );

        setToken(null);
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                isLoggedIn: Boolean(token),
                loading,
                login,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context =
        useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
}