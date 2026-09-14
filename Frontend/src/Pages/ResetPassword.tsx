import { useState } from "react";
import {
    useNavigate,
    useSearchParams
} from "react-router-dom";
import api from "../Services/api";

function ResetPassword() {
    const navigate = useNavigate();

    const [searchParams] =
        useSearchParams();

    const token =
        searchParams.get("token") || "";

    const [password, setPassword] =
        useState("");

    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [message, setMessage] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const handleSubmit = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();

        setMessage("");

        if (password !== confirmPassword) {
            setMessage(
                "Passwords do not match"
            );

            return;
        }

        if (password.length < 8) {
            setMessage(
                "Password must be at least 8 characters long"
            );

            return;
        }

        if (!token) {
            setMessage(
                "Reset token is missing"
            );

            return;
        }

        setLoading(true);

        try {
            const response = await api.post(
                "/auth/reset-password",
                {
                    token,
                    new_password: password
                }
            );

            setMessage(
                response.data.message
            );

            setPassword("");
            setConfirmPassword("");

            setTimeout(() => {
                navigate("/login");
            }, 1500);

        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Failed to reset password"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">

            <h1>VaultX</h1>

            <h2>Reset Password</h2>

            <form onSubmit={handleSubmit}>

                <input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(
                            e.target.value
                        )
                    }
                    required
                />

                <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) =>
                        setConfirmPassword(
                            e.target.value
                        )
                    }
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Resetting..."
                        : "Reset Password"}
                </button>

            </form>

            {message && (
                <p>
                    {message}
                </p>
            )}

            <button
                onClick={() =>
                    navigate("/login")
                }
            >
                Back to Login
            </button>

        </div>
    );
}

export default ResetPassword;