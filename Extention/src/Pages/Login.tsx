import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../Services/api";
import { useAuth } from "../Context/AuthContext";

function Login() {
    const navigate = useNavigate();

    const {
        login,
        session2FARequired,
        verifySession2FA
    } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");

    const [requires2FA, setRequires2FA] =
        useState(session2FARequired);

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            const response = await api.post(
                "/auth/login",
                {
                    email,
                    password
                }
            );

            if (response.data.requires_2fa) {
                setRequires2FA(true);
                setMessage(
                    "Enter the 6-digit OTP from your authenticator app."
                );
                return;
            }

            await login(
                response.data.access_token,
                response.data.refresh_token
            );

            setMessage("Login successful!");

            setTimeout(() => {
                navigate("/dashboard");
            }, 300);
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                error.vaultxMessage ||
                "Login failed"
            );
        } finally {
            setLoading(false);
        }
    };

    const handle2FAVerification = async (
        e: React.FormEvent
    ) => {
        e.preventDefault();

        if (!otp || !/^\d{6}$/.test(otp)) {
            setMessage(
                "OTP must be a 6-digit number."
            );
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            if (session2FARequired) {
                const success =
                    await verifySession2FA(otp);

                if (!success) {
                    setMessage(
                        "Invalid OTP or session expired."
                    );
                    return;
                }
            } else {
                const response = await api.post(
                    "/auth/2fa/login-verify",
                    {
                        email,
                        password,
                        otp
                    }
                );

                await login(
                    response.data.access_token,
                    response.data.refresh_token
                );
            }

            setMessage(
                "2FA verified. Login successful!"
            );

            setTimeout(() => {
                navigate("/dashboard");
            }, 300);
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                error.vaultxMessage ||
                "OTP verification failed."
            );
        } finally {
            setLoading(false);
        }
    };

    const isSessionVerification =
        session2FARequired;

    return (
        <div>
            <h1>VaultX</h1>

            {!requires2FA && !isSessionVerification ? (
                <>
                    <h2>Login</h2>

                    <form onSubmit={handleLogin}>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            required
                        />

                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) =>
                                setPassword(e.target.value)
                            }
                            required
                        />

                        <button
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? "Logging in..."
                                : "Login"}
                        </button>
                    </form>
                </>
            ) : (
                <>
                    <h2>
                        {isSessionVerification
                            ? "Session Verification"
                            : "Two-Factor Authentication"}
                    </h2>

                    <p>
                        {isSessionVerification
                            ? "Your session needs verification. Enter only the OTP from your authenticator app."
                            : "Enter the 6-digit code from your authenticator app."}
                    </p>

                    <form
                        onSubmit={handle2FAVerification}
                    >
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) =>
                                setOtp(
                                    e.target.value.replace(/\D/g, "")
                                )
                            }
                            required
                        />

                        <button
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? "Verifying..."
                                : "Verify OTP"}
                        </button>
                    </form>

                    {!isSessionVerification && (
                        <button
                            type="button"
                            onClick={() => {
                                setRequires2FA(false);
                                setOtp("");
                                setMessage("");
                            }}
                        >
                            Back to Login
                        </button>
                    )}
                </>
            )}

            <p>{message}</p>

            {!requires2FA && !isSessionVerification && (
                <>
                    <button
                        onClick={() =>
                            navigate("/forgot-password")
                        }
                    >
                        Forgot Password?
                    </button>

                    <button
                        onClick={() =>
                            navigate("/register")
                        }
                    >
                        Don't have an account? Register
                    </button>
                </>
            )}
        </div>
    );
}

export default Login;