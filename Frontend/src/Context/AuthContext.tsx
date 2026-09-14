import {
    createContext,
    useContext,
    useState,
    type ReactNode
} from "react";

type AuthContextType = {
    token: string | null;
    isLoggedIn: boolean;
    login: (token: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

export function AuthProvider({
    children
}: {
    children: ReactNode;
}) {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem("token");
    });

    const login = (newToken: string) => {
        if (!newToken) {
            return;
        }

        localStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                isLoggedIn: Boolean(token),
                login,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
}