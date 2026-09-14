import {
    BrowserRouter,
    Navigate,
    Route,
    Routes
} from "react-router-dom";

import Login from "./Pages/Login";
import Register from "./Pages/Register";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";
import Dashboard from "./Pages/Dashboard";

import ProtectedRoute from "./Components/ProtectedRoute";

import {
    AuthProvider,
    useAuth
} from "./Context/AuthContext";

function ExtensionApp() {
    const {
        loading
    } = useAuth();

    if (loading) {
        return (
            <main className="app-loading">
                <h1>VaultX</h1>
                <p>Loading...</p>
            </main>
        );
    }

    return (
        <Routes>
            {/* Public routes */}

            <Route
                path="/login"
                element={<Login />}
            />

            <Route
                path="/register"
                element={<Register />}
            />

            <Route
                path="/forgot-password"
                element={<ForgotPassword />}
            />

            <Route
                path="/reset-password"
                element={<ResetPassword />}
            />

            {/* Protected Dashboard */}

            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            {/* Default route */}

            <Route
                path="/"
                element={<HomeRedirect />}
            />

            {/* Unknown routes */}

            <Route
                path="*"
                element={<HomeRedirect />}
            />
        </Routes>
    );
}

function HomeRedirect() {
    const {
        isLoggedIn
    } = useAuth();

    return (
        <Navigate
            to={
                isLoggedIn
                    ? "/dashboard"
                    : "/login"
            }
            replace
        />
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ExtensionApp />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;