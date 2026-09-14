const API_BASE_URL = "http://127.0.0.1:8000";

const GOOGLE_CLIENT_ID =
    "39063674742-fchrcdvkro4de4iqburbe3viuracq9qb.apps.googleusercontent.com";

const GOOGLE_SCOPE =
    "https://www.googleapis.com/auth/gmail.readonly";


/* =========================================================
   EXTENSION INSTALLED
   ========================================================= */

chrome.runtime.onInstalled.addListener(() => {
    console.log("VaultX extension installed.");
});


/* =========================================================
   MESSAGE LISTENER
   ========================================================= */

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (
            !message ||
            typeof message !== "object" ||
            typeof message.type !== "string"
        ) {
            sendResponse({
                success: false,
                error: "Invalid message."
            });

            return false;
        }


        /* =================================================
           GOOGLE ACCOUNT CONNECTION
           ================================================= */

        if (
            message.type === "VAULTX_CONNECT_GOOGLE"
        ) {
            connectGoogleAccount(sendResponse);
            return true;
        }


        /* =================================================
           CHECK CURRENT PAGE
           ================================================= */

        if (
            message.type === "VAULTX_CHECK_PAGE"
        ) {
            checkCurrentPage(
                sender,
                sendResponse
            );

            return true;
        }


        /* =================================================
           CREDENTIAL AUTOFILL
           ================================================= */

        if (
            message.type === "VAULTX_AUTOFILL"
        ) {
            if (
                typeof message.credentialId !== "number" ||
                !Number.isInteger(message.credentialId) ||
                message.credentialId <= 0
            ) {
                sendResponse({
                    success: false,
                    error: "Invalid credential ID."
                });

                return false;
            }

            autofillCredential(
                message.credentialId,
                message.username || "",
                sender,
                sendResponse
            );

            return true;
        }


        /* =================================================
           GET LATEST GMAIL OTP
           ================================================= */

        if (
            message.type === "VAULTX_GET_LATEST_OTP"
        ) {
            getLatestGmailOtp(
                sender,
                sendResponse
            );

            return true;
        }


        /* =================================================
           UNKNOWN MESSAGE
           ================================================= */

        sendResponse({
            success: false,
            error: "Unknown VaultX message type."
        });

        return false;
    }
);


/* =========================================================
   GOOGLE OAUTH HELPERS
   ========================================================= */

function generateRandomString(length = 64) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    const randomValues =
        new Uint8Array(length);

    crypto.getRandomValues(
        randomValues
    );

    let result = "";

    for (let i = 0; i < length; i++) {
        result += characters[
            randomValues[i] % characters.length
        ];
    }

    return result;
}


function base64UrlEncode(arrayBuffer) {
    const bytes =
        new Uint8Array(arrayBuffer);

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


async function createCodeChallenge(codeVerifier) {
    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(codeVerifier);

    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return base64UrlEncode(digest);
}


/* =========================================================
   CONNECT GOOGLE ACCOUNT
   ========================================================= */

async function connectGoogleAccount(sendResponse) {
    try {
        const vaultxToken =
            await getToken();

        if (!vaultxToken) {
            sendResponse({
                success: false,
                error:
                    "VaultX session expired. Please log in again."
            });

            return;
        }

        const redirectUri =
            chrome.identity.getRedirectURL("oauth2");

        const state =
            generateRandomString(32);

        const codeVerifier =
            generateRandomString(64);

        const codeChallenge =
            await createCodeChallenge(
                codeVerifier
            );

        await chrome.storage.session.set({
            googleOAuthState: state,
            googleCodeVerifier: codeVerifier
        });

        const authUrl =
            new URL(
                "https://accounts.google.com/o/oauth2/v2/auth"
            );

        authUrl.searchParams.set(
            "client_id",
            GOOGLE_CLIENT_ID
        );

        authUrl.searchParams.set(
            "redirect_uri",
            redirectUri
        );

        authUrl.searchParams.set(
            "response_type",
            "code"
        );

        authUrl.searchParams.set(
            "scope",
            GOOGLE_SCOPE
        );

        authUrl.searchParams.set(
            "access_type",
            "offline"
        );

        authUrl.searchParams.set(
            "prompt",
            "consent"
        );

        authUrl.searchParams.set(
            "state",
            state
        );

        authUrl.searchParams.set(
            "code_challenge",
            codeChallenge
        );

        authUrl.searchParams.set(
            "code_challenge_method",
            "S256"
        );

        console.log(
            "VaultX: Starting Google OAuth."
        );

        const responseUrl =
            await chrome.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true
            });

        if (!responseUrl) {
            await clearGoogleOAuthSession();

            sendResponse({
                success: false,
                error:
                    "Google authorization was cancelled."
            });

            return;
        }

        const callbackUrl =
            new URL(responseUrl);

        const returnedState =
            callbackUrl.searchParams.get("state");

        const returnedCode =
            callbackUrl.searchParams.get("code");

        const oauthError =
            callbackUrl.searchParams.get("error");

        const storedOAuth =
            await chrome.storage.session.get([
                "googleOAuthState",
                "googleCodeVerifier"
            ]);

        await clearGoogleOAuthSession();

        if (
            oauthError
        ) {
            sendResponse({
                success: false,
                error:
                    "Google authorization was denied."
            });

            return;
        }

        if (
            !returnedState ||
            returnedState !== storedOAuth.googleOAuthState
        ) {
            sendResponse({
                success: false,
                error:
                    "Google OAuth state validation failed."
            });

            return;
        }

        if (
            !returnedCode
        ) {
            sendResponse({
                success: false,
                error:
                    "Google did not return an authorization code."
            });

            return;
        }

        const storedCodeVerifier =
            storedOAuth.googleCodeVerifier;

        if (
            typeof storedCodeVerifier !== "string"
        ) {
            sendResponse({
                success: false,
                error:
                    "Google OAuth verification data is missing."
            });

            return;
        }

        const connectUrl =
            new URL(
                `${API_BASE_URL}/auth/google/connect`
            );

        connectUrl.searchParams.set(
            "code",
            returnedCode
        );

        connectUrl.searchParams.set(
            "code_verifier",
            storedCodeVerifier
        );

        const connectResponse =
            await fetch(
                connectUrl.toString(),
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${vaultxToken}`
                    }
                }
            );

        const data =
            await connectResponse.json();

        if (
            !connectResponse.ok
        ) {
            if (
                connectResponse.status === 401
            ) {
                await chrome.storage.local.remove(
                    "token"
                );
            }

            sendResponse({
                success: false,
                error:
                    data?.detail ||
                    "Unable to connect Google account."
            });

            return;
        }

        console.log(
            "VaultX: Google account connected:",
            data.google_account_email
        );

        sendResponse({
            success: true,
            googleAccountEmail:
                data.google_account_email
        });

    } catch (error) {
        console.error(
            "VaultX Google OAuth failed:",
            error
        );

        await clearGoogleOAuthSession();

        sendResponse({
            success: false,
            error:
                error?.message ||
                "Unable to connect Google account."
        });
    }
}


async function clearGoogleOAuthSession() {
    await chrome.storage.session.remove([
        "googleOAuthState",
        "googleCodeVerifier"
    ]);
}


/* =========================================================
   TOKEN AND SETTINGS
   ========================================================= */

async function getToken() {
    const result =
        await chrome.storage.local.get(
            "token"
        );

    return typeof result.token === "string"
        ? result.token
        : null;
}


async function isAutofillEnabled() {
    const result =
        await chrome.storage.local.get(
            "autofillEnabled"
        );

    return result.autofillEnabled !== false;
}


/* =========================================================
   WEBSITE HELPERS
   ========================================================= */

function normalizeHostname(hostname) {
    return String(hostname || "")
        .toLowerCase()
        .replace(/^www\./, "")
        .trim();
}


function getCredentialHostname(websiteUrl) {
    if (!websiteUrl) {
        return null;
    }

    try {
        const url =
            new URL(websiteUrl);

        return normalizeHostname(
            url.hostname
        );

    } catch {
        return null;
    }
}


/* =========================================================
   CHECK CURRENT PAGE
   ========================================================= */

async function checkCurrentPage(
    sender,
    sendResponse
) {
    try {
        if (
            !sender.tab ||
            !sender.tab.id
        ) {
            sendResponse({
                success: false,
                error: "No active tab."
            });

            return;
        }

        const autofillEnabled =
            await isAutofillEnabled();

        if (!autofillEnabled) {
            sendResponse({
                success: true,
                authenticated: false,
                autofillEnabled: false,
                credentials: []
            });

            return;
        }

        let pageInfo;

        try {
            pageInfo =
                await chrome.tabs.sendMessage(
                    sender.tab.id,
                    {
                        type:
                            "VAULTX_GET_PAGE_INFO"
                    }
                );
        } catch (error) {
            console.error(
                "VaultX: Unable to communicate with content script.",
                error
            );

            sendResponse({
                success: false,
                error:
                    "Content script is not available. Refresh the webpage."
            });

            return;
        }

        const token =
            await getToken();

        if (!token) {
            sendResponse({
                success: true,
                authenticated: false,
                autofillEnabled: true,
                data: pageInfo,
                credentials: []
            });

            return;
        }

        const hostname =
            normalizeHostname(
                pageInfo?.hostname
            );

        if (!hostname) {
            sendResponse({
                success: true,
                authenticated: true,
                autofillEnabled: true,
                credentials: []
            });

            return;
        }

        const response =
            await fetch(
                `${API_BASE_URL}/credentials/?search=${encodeURIComponent(hostname)}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            if (
                response.status === 401
            ) {
                await chrome.storage.local.remove(
                    "token"
                );
            }

            sendResponse({
                success: false,
                error:
                    data?.detail ||
                    "Unable to fetch credentials."
            });

            return;
        }

        const credentials =
            Array.isArray(data.items)
                ? data.items
                : [];

        console.log(
            "VaultX: Matching credentials found:",
            credentials.length
        );

        if (
            credentials.length > 0
        ) {
            try {
                await chrome.tabs.sendMessage(
                    sender.tab.id,
                    {
                        type:
                            "VAULTX_SHOW_MATCHES",

                        credentials
                    }
                );
            } catch (error) {
                console.error(
                    "VaultX: Unable to show credentials.",
                    error
                );
            }
        }

        sendResponse({
            success: true,
            authenticated: true,
            autofillEnabled: true,
            data: pageInfo,
            credentials
        });

    } catch (error) {
        console.error(
            "VaultX page check failed:",
            error
        );

        sendResponse({
            success: false,
            error:
                "Unable to check current webpage."
        });
    }
}


/* =========================================================
   AUTOFILL CREDENTIAL
   ========================================================= */

async function autofillCredential(
    credentialId,
    username,
    sender,
    sendResponse
) {
    try {
        if (
            !sender.tab ||
            !sender.tab.id
        ) {
            sendResponse({
                success: false,
                error: "No active tab."
            });

            return;
        }

        const token =
            await getToken();

        if (!token) {
            sendResponse({
                success: false,
                error:
                    "VaultX session expired. Please log in again."
            });

            return;
        }

        let pageInfo;

        try {
            pageInfo =
                await chrome.tabs.sendMessage(
                    sender.tab.id,
                    {
                        type:
                            "VAULTX_GET_PAGE_INFO"
                    }
                );
        } catch {
            sendResponse({
                success: false,
                error:
                    "Content script is not available. Refresh the webpage."
            });

            return;
        }

        const currentHostname =
            normalizeHostname(
                pageInfo?.hostname
            );

        if (!currentHostname) {
            sendResponse({
                success: false,
                error:
                    "Unable to identify current website."
            });

            return;
        }

        const credentialResponse =
            await fetch(
                `${API_BASE_URL}/credentials/?search=${encodeURIComponent(currentHostname)}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

        const credentialData =
            await credentialResponse.json();

        if (
            !credentialResponse.ok
        ) {
            sendResponse({
                success: false,
                error:
                    credentialData?.detail ||
                    "Unable to verify credential."
            });

            return;
        }

        const credentials =
            Array.isArray(credentialData.items)
                ? credentialData.items
                : [];

        const selectedCredential =
            credentials.find(
                (credential) =>
                    credential.id === credentialId
            );

        if (!selectedCredential) {
            sendResponse({
                success: false,
                error:
                    "Credential is not valid for this website."
            });

            return;
        }

        const credentialHostname =
            getCredentialHostname(
                selectedCredential.website_url
            );

        if (
            !credentialHostname ||
            credentialHostname !== currentHostname
        ) {
            sendResponse({
                success: false,
                error:
                    "Autofill blocked: website does not match the saved credential."
            });

            return;
        }

        const response =
            await fetch(
                `${API_BASE_URL}/credentials/${credentialId}/reveal`,
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

        const data =
            await response.json();

        if (
            !response.ok
        ) {
            sendResponse({
                success: false,
                error:
                    data?.detail ||
                    "Password reveal failed."
            });

            return;
        }

        let contentResponse;

        try {
            contentResponse =
                await chrome.tabs.sendMessage(
                    sender.tab.id,
                    {
                        type:
                            "VAULTX_FILL_CREDENTIAL",

                        username:
                            username ||
                            selectedCredential.username ||
                            "",

                        password:
                            data.password
                    }
                );
        } catch (error) {
            console.error(
                "VaultX: Credential message failed.",
                error
            );

            sendResponse({
                success: false,
                error:
                    "Unable to fill credentials. Refresh the webpage."
            });

            return;
        }

        console.log(
            "VaultX: Credential content response:",
            contentResponse
        );

        sendResponse({
            success: true
        });

    } catch (error) {
        console.error(
            "VaultX autofill failed:",
            error
        );

        sendResponse({
            success: false,
            error:
                error?.message ||
                "Unable to autofill credential."
        });
    }
}


/* =========================================================
   GET LATEST GMAIL OTP
   ========================================================= */

async function getLatestGmailOtp(
    sender,
    sendResponse
) {
    try {
        console.log(
            "VaultX: OTP request received."
        );

        const tabId =
            sender?.tab?.id;

        if (
            !tabId
        ) {
            console.error(
                "VaultX: Current tab ID is missing."
            );

            sendResponse({
                success: false,
                error:
                    "Unable to identify the current webpage."
            });

            return;
        }

        console.log(
            "VaultX: Current tab ID:",
            tabId
        );

        const token =
            await getToken();

        if (
            !token
        ) {
            sendResponse({
                success: false,
                error:
                    "VaultX session expired. Please log in again."
            });

            return;
        }

        console.log(
            "VaultX: Calling Gmail OTP backend..."
        );

        const response =
            await fetch(
                `${API_BASE_URL}/auth/google/latest-otp`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch {
            sendResponse({
                success: false,
                error:
                    "Backend returned an invalid response."
            });

            return;
        }

        console.log(
            "VaultX: Gmail OTP backend response:",
            {
                status: response.status,
                data
            }
        );

        if (
            !response.ok
        ) {
            if (
                response.status === 401
            ) {
                await chrome.storage.local.remove(
                    "token"
                );
            }

            sendResponse({
                success: false,
                error:
                    data?.detail ||
                    "Unable to fetch Gmail OTP."
            });

            return;
        }

        const otp =
            String(
                data?.otp ||
                ""
            ).replace(
                /\D/g,
                ""
            );

        if (
            !otp
        ) {
            console.warn(
                "VaultX: Backend did not return a valid OTP."
            );

            sendResponse({
                success: true,
                otp: null,
                message:
                    "No recent OTP found."
            });

            return;
        }

        console.log(
            "VaultX: OTP received from backend."
        );

        let contentResponse;

        try {
            contentResponse =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "VAULTX_FILL_OTP",

                        otp
                    }
                );
        } catch (error) {
            console.error(
                "VaultX: Unable to send OTP to content script.",
                error
            );

            sendResponse({
                success: false,
                error:
                    "OTP was fetched, but the webpage could not receive it. Refresh the webpage and try again."
            });

            return;
        }

        console.log(
            "VaultX: Content script OTP response:",
            contentResponse
        );

        if (
            !contentResponse?.success
        ) {
            sendResponse({
                success: false,
                error:
                    "OTP was fetched, but OTP fields were not found."
            });

            return;
        }

        console.log(
            "VaultX: OTP successfully sent and filled."
        );

        sendResponse({
            success: true,
            otp,
            message:
                "OTP fetched and filled successfully."
        });

    } catch (error) {
        console.error(
            "VaultX Gmail OTP fetch failed:",
            error
        );

        sendResponse({
            success: false,
            error:
                error?.message ||
                "Unable to fetch Gmail OTP."
        });
    }
}