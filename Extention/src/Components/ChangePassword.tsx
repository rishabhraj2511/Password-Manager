import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api from "../Services/api";

function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);

    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);
    const [twoFactorMessage, setTwoFactorMessage] = useState("");

    const [twoFactorSetup, setTwoFactorSetup] = useState(false);
    const [twoFactorSecret, setTwoFactorSecret] = useState("");
    const [provisioningUri, setProvisioningUri] = useState("");
    const [otp, setOtp] = useState("");

    const getPasswordStrength = (password: string) => {
        if (!password) {
            return {
                label: "",
                score: 0
            };
        }

        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 2) {
            return {
                label: "Weak",
                score
            };
        }

        if (score <= 4) {
            return {
                label: "Medium",
                score
            };
        }

        return {
            label: "Strong",
            score
        };
    };

    const passwordStrength =
        getPasswordStrength(newPassword);

    useEffect(() => {
        const loadSecuritySettings = async () => {
            try {
                const response = await api.get("/auth/me");

                setTwoFactorEnabled(
                    response.data?.two_factor_enabled || false
                );
            } catch {
                // Ignore initial security settings error.
            }
        };

        loadSecuritySettings();
    }, []);

    const setupTwoFactor = async () => {
        setTwoFactorLoading(true);
        setTwoFactorMessage("");

        try {
            const response = await api.post(
                "/auth/2fa/setup"
            );

            setTwoFactorSecret(
                response.data.secret
            );

            setProvisioningUri(
                response.data.provisioning_uri
            );

            setTwoFactorSetup(true);

            setTwoFactorMessage(
                "2FA setup generated successfully. Scan the QR code with your authenticator app."
            );

        } catch (error: any) {
            setTwoFactorMessage(
                error.response?.data?.detail ||
                "Failed to start 2FA setup."
            );
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const verifyTwoFactor = async () => {
        if (!otp) {
            setTwoFactorMessage(
                "Please enter the 6-digit OTP."
            );
            return;
        }

        if (!/^\d{6}$/.test(otp)) {
            setTwoFactorMessage(
                "OTP must be a 6-digit number."
            );
            return;
        }

        setTwoFactorLoading(true);
        setTwoFactorMessage("");

        try {
            const response = await api.post(
                `/auth/2fa/verify?otp=${otp}`
            );

            setTwoFactorEnabled(
                response.data.two_factor_enabled
            );

            setTwoFactorSetup(false);
            setTwoFactorSecret("");
            setProvisioningUri("");
            setOtp("");

            setTwoFactorMessage(
                response.data.message ||
                "Two-factor authentication enabled successfully."
            );

        } catch (error: any) {
            setTwoFactorMessage(
                error.response?.data?.detail ||
                "Invalid or expired OTP."
            );
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const disableTwoFactor = async () => {
        setTwoFactorLoading(true);
        setTwoFactorMessage("");

        try {
            const response = await api.post(
                "/auth/2fa/toggle?enabled=false"
            );

            setTwoFactorEnabled(
                response.data.two_factor_enabled
            );

            setTwoFactorSetup(false);
            setTwoFactorSecret("");
            setProvisioningUri("");
            setOtp("");

            setTwoFactorMessage(
                response.data.message ||
                "Two-factor authentication disabled successfully."
            );

        } catch (error: any) {
            setTwoFactorMessage(
                error.response?.data?.detail ||
                "Failed to disable 2FA."
            );
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const changePassword = async () => {
        setMessage("");
        setSuccess(false);

        if (!currentPassword) {
            setMessage("Current password is required.");
            return;
        }

        if (!newPassword) {
            setMessage("New password is required.");
            return;
        }

        if (!confirmPassword) {
            setMessage("Please confirm your new password.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage(
                "New password and confirm password do not match."
            );
            return;
        }

        if (newPassword.length < 8) {
            setMessage(
                "New password must be at least 8 characters long."
            );
            return;
        }

        if (passwordStrength.label === "Weak") {
            setMessage(
                "Please choose a stronger password."
            );
            return;
        }

        if (currentPassword === newPassword) {
            setMessage(
                "New password must be different from current password."
            );
            return;
        }

        try {
            setLoading(true);

            const response = await api.post(
                "/auth/change-password",
                {
                    current_password: currentPassword,
                    new_password: newPassword
                }
            );

            setSuccess(true);

            setMessage(
                response.data?.message ||
                "Password changed successfully!"
            );

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

        } catch (error: any) {
            setSuccess(false);

            setMessage(
                error.response?.data?.detail ||
                "Failed to change password."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="account-security-content">

            <div className="account-password-section">
                <h3>Change Account Password</h3>
                <p>Update your VaultX account password to keep your account secure.</p>

                <div className="account-password-form">

                    <label>
                        Current Password
                        <input
                            type="password"
                            placeholder="Enter current password"
                            value={currentPassword}
                            onChange={(e) =>
                                setCurrentPassword(e.target.value)
                            }
                        />
                    </label>

                    <label>
                        New Password
                        <input
                            type="password"
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) =>
                                setNewPassword(e.target.value)
                            }
                        />
                    </label>

                {newPassword && (
                    <div className="password-strength">

                        <div className="strength-header">

                            <span>
                                Password Strength
                            </span>

                            <strong
                                className={`strength-${passwordStrength.label.toLowerCase()}`}
                            >
                                {passwordStrength.label}
                            </strong>

                        </div>

                        <div className="strength-bar">

                            <div
                                className={`strength-fill strength-${passwordStrength.label.toLowerCase()}`}
                                style={{
                                    width:
                                        passwordStrength.label === "Weak"
                                            ? "33%"
                                            : passwordStrength.label === "Medium"
                                                ? "66%"
                                                : "100%"
                                }}
                            />

                        </div>

                    </div>
                )}

                    <label>
                        Confirm New Password
                        <input
                            type="password"
                            placeholder="Re-enter new password"
                            value={confirmPassword}
                            onChange={(e) =>
                                setConfirmPassword(e.target.value)
                            }
                        />
                    </label>

                {confirmPassword &&
                    newPassword !== confirmPassword && (
                        <p className="form-message">
                            Passwords do not match.
                        </p>
                    )}

                    <button
                        className="primary-button"
                        onClick={changePassword}
                        disabled={loading}
                    >
                        {loading ? "Changing Password..." : "Update Password"}
                    </button>

                {message && (
                    <p
                        className={
                            success
                                ? "success-message"
                                : "form-message"
                        }
                    >
                        {message}
                    </p>
                )}

                </div>
            </div>

            <section className="two-factor-section">

                <h3>Two-Factor Authentication</h3>

                <p>Add an extra layer of security to your VaultX account.</p>

                <div className="two-factor-status">

                    <div>
                        <strong>
                            2FA Status:{" "}
                            {twoFactorEnabled
                                ? "Enabled"
                                : "Disabled"}
                        </strong>

                        <p>
                            {twoFactorEnabled
                                ? "Two-factor authentication is currently active."
                                : "Two-factor authentication is currently inactive."}
                        </p>
                    </div>

                    {!twoFactorEnabled && !twoFactorSetup && (
                        <button
                            onClick={setupTwoFactor}
                            disabled={twoFactorLoading}
                        >
                            {twoFactorLoading
                                ? "Setting Up..."
                                : "Enable 2FA"}
                        </button>
                    )}

                    {twoFactorEnabled && (
                        <button
                            onClick={disableTwoFactor}
                            disabled={twoFactorLoading}
                        >
                            {twoFactorLoading
                                ? "Updating..."
                                : "Disable 2FA"}
                        </button>
                    )}

                </div>

                {twoFactorSetup && !twoFactorEnabled && (
                    <div className="two-factor-setup">

                        <h3>
                            Set Up Authenticator
                        </h3>

                        <p>
                            Scan this QR code using your
                            authenticator app.
                        </p>

                        <div className="qr-code">
                            <QRCodeSVG
                                value={provisioningUri}
                                size={220}
                                level="M"
                            />
                        </div>

                        <p>
                            After scanning, enter the
                            6-digit code generated by
                            your authenticator app.
                        </p>

                        <input
                            className="otp-input"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) =>
                                setOtp(
                                    e.target.value
                                        .replace(/\D/g, "")
                                )
                            }
                        />

                        <button
                            className="primary-button"
                            onClick={verifyTwoFactor}
                            disabled={twoFactorLoading}
                        >
                            {twoFactorLoading
                                ? "Verifying..."
                                : "Verify & Enable 2FA"}
                        </button>

                        <button
                            className="secondary-button"
                            type="button"
                            onClick={() => {
                                setTwoFactorSetup(false);
                                setTwoFactorSecret("");
                                setProvisioningUri("");
                                setOtp("");
                                setTwoFactorMessage("");
                            }}
                        >
                            Cancel
                        </button>

                        <details
                            style={{
                                marginTop: "15px",
                                textAlign: "left"
                            }}
                        >
                            <summary>
                                Can't scan the QR code?
                            </summary>

                            <p
                                style={{
                                    marginTop: "10px"
                                }}
                            >
                                Enter this setup key manually
                                in your authenticator app:
                            </p>

                            <div
                                style={{
                                    padding: "12px",
                                    background: "#0f1117",
                                    borderRadius: "8px",
                                    wordBreak: "break-all",
                                    fontFamily: "monospace"
                                }}
                            >
                                {twoFactorSecret}
                            </div>
                        </details>

                    </div>
                )}

                {twoFactorMessage && (
                    <p
                        className={
                            twoFactorMessage
                                .toLowerCase()
                                .includes("success")
                                ? "success-message"
                                : "form-message"
                        }
                        style={{
                            marginTop: "15px"
                        }}
                    >
                        {twoFactorMessage}
                    </p>
                )}

            </section>

        </div>
    );
}

export default ChangePassword;