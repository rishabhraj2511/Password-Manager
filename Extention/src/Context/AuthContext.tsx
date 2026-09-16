import {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useState,
    type ReactNode
} from "react";
import api from "../Services/api";

type AuthContextType = {
    token: string | null;
    isLoggedIn: boolean;
    loading: boolean;
    session2FARequired: boolean;
    login: (accessToken: string, refreshToken: string) => Promise<void>;
    verifySession2FA: (otp: string) => Promise<boolean>;
    logout: () => Promise<void>;
};

const AuthContext =
    createContext<AuthContextType | undefined>(
        undefined
    );

function getTokenExpiry(token: string): number | null {
    try {
        const parts = token.split(".");

        if (parts.length !== 3) {
            return null;
        }

        const normalizedPayload = parts[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const payload = JSON.parse(
            atob(normalizedPayload)
        );

        return typeof payload.exp === "number"
            ? payload.exp * 1000
            : null;
    } catch {
        return null;
    }
}

export function AuthProvider({
    children
}: {
    children: ReactNode;
}) {
    const [token, setToken] =
        useState<string | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [session2FARequired, setSession2FARequired] =
        useState(false);

    const clearSession = useCallback(async () => {
        await chrome.storage.local.remove([
            "token",
            "refresh_token"
        ]);

        setToken(null);
        setSession2FARequired(false);
    }, []);

    const saveSession = useCallback(async (
        accessToken: string,
        refreshToken: string
    ) => {
        await chrome.storage.local.set({
            token: accessToken,
            refresh_token: refreshToken
        });

        setToken(accessToken);
        setSession2FARequired(false);
    }, []);

    const refreshSession = useCallback(async (
        refreshToken: string,
        otp?: string
    ): Promise<boolean> => {
        try {
            const response = await api.post(
                "/auth/session/refresh",
                {
                    refresh_token: refreshToken,
                    ...(otp ? { otp } : {})
                }
            );

            if (response.data.requires_session_2fa) {
                setToken(null);
                setSession2FARequired(true);
                return false;
            }

            const newAccessToken =
                response.data.access_token;

            const newRefreshToken =
                response.data.refresh_token ||
                refreshToken;

            if (
                typeof newAccessToken !== "string" ||
                !newAccessToken
            ) {
                await clearSession();
                return false;
            }

            await saveSession(
                newAccessToken,
                newRefreshToken
            );

            return true;
        } catch (error) {
            console.error(
                "VaultX: Failed to refresh session.",
                error
            );

            await clearSession();
            return false;
        }
    }, [clearSession, saveSession]);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const result =
                    await chrome.storage.local.get([
                        "token",
                        "refresh_token"
                    ]);

                const storedToken =
                    typeof result.token === "string"
                        ? result.token
                        : null;

                const storedRefreshToken =
                    typeof result.refresh_token === "string"
                        ? result.refresh_token
                        : null;

                if (!storedRefreshToken) {
                    await clearSession();
                    return;
                }

                if (!storedToken) {
                    await refreshSession(
                        storedRefreshToken
                    );
                    return;
                }

                const expiry =
                    getTokenExpiry(storedToken);

                const isExpired =
                    !expiry ||
                    Date.now() >= expiry - 5000;

                if (isExpired) {
                    await refreshSession(
                        storedRefreshToken
                    );
                    return;
                }

                setToken(storedToken);
                setSession2FARequired(false);
            } catch (error) {
                console.error(
                    "VaultX: Failed to restore session.",
                    error
                );

                await clearSession();
            } finally {
                setLoading(false);
            }
        };

        restoreSession();
    }, [clearSession, refreshSession]);

    const login = useCallback(async (
        accessToken: string,
        refreshToken: string
    ) => {
        if (!accessToken || !refreshToken) {
            return;
        }

        await saveSession(
            accessToken,
            refreshToken
        );
    }, [saveSession]);

    const verifySession2FA = useCallback(async (
        otp: string
    ): Promise<boolean> => {
        const result =
            await chrome.storage.local.get(
                "refresh_token"
            );

        const refreshToken =
            typeof result.refresh_token === "string"
                ? result.refresh_token
                : null;

        if (!refreshToken) {
            await clearSession();
            return false;
        }

        return refreshSession(
            refreshToken,
            otp
        );
    }, [clearSession, refreshSession]);

    const logout = useCallback(async () => {
        await clearSession();
    }, [clearSession]);

    return (
        <AuthContext.Provider
            value={{
                token,
                isLoggedIn: Boolean(token),
                loading,
                session2FARequired,
                login,
                verifySession2FA,
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