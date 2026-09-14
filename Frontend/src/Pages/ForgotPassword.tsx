import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../Services/api";

function ForgotPassword() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            const response = await api.post(
                "/auth/forgot-password",
                {
                    email
                }
            );

            setMessage(
                response.data.message
            );

        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Unable to process password reset request."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">

            <h1>VaultX</h1>

            <h2>Forgot Password</h2>

            <p>
                Enter your registered email address.
            </p>

            <form onSubmit={handleSubmit}>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Sending..."
                        : "Send Reset Link"}
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

export default ForgotPassword;