import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../Services/api";

function Register() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            await api.post("/auth/register", {
                email,
                password
            });

            setMessage("Registration successful!");

            setTimeout(() => {
                navigate("/login");
            }, 1000);
        } catch (error: any) {
            setMessage(
                error.response?.data?.detail ||
                "Registration failed"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>VaultX</h1>

            <h2>Register</h2>

            <form onSubmit={handleRegister}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Registering..." : "Register"}
                </button>
            </form>

            <p>{message}</p>

            <button onClick={() => navigate("/login")}>
                Already have an account? Login
            </button>
        </div>
    );
}

export default Register;