import axios from "axios";

const api = axios.create({
    baseURL: "http://127.0.0.1:8000",
    headers: {
        "Content-Type": "application/json"
    }
});

api.interceptors.request.use(
    async (config) => {
        try {
            const result =
                await chrome.storage.local.get(
                    "token"
                );

            const accessToken =
                typeof result.token === "string"
                    ? result.token
                    : null;

            if (accessToken) {
                config.headers =
                    config.headers || {};

                config.headers.Authorization =
                    `Bearer ${accessToken}`;
            }
        } catch (error) {
            console.error(
                "VaultX: Failed to load authentication token.",
                error
            );
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const status =
            error.response?.status;

        const requestUrl =
            error.config?.url || "";

        const isAuthRequest =
            requestUrl.includes(
                "/auth/login"
            ) ||
            requestUrl.includes(
                "/auth/2fa/login-verify"
            ) ||
            requestUrl.includes(
                "/auth/register"
            ) ||
            requestUrl.includes(
                "/auth/forgot-password"
            ) ||
            requestUrl.includes(
                "/auth/reset-password"
            );

        let message =
            "Something went wrong. Please try again.";

        if (!error.response) {
            message =
                "Unable to connect to VaultX. Please check that the backend is running.";
        } else if (status === 400) {
            message =
                error.response.data?.detail ||
                "Invalid request. Please check your input.";
        } else if (status === 401) {
            message =
                error.response.data?.detail ||
                "Your session has expired. Please log in again.";

            if (!isAuthRequest) {
                await chrome.storage.local.remove(
                    "token"
                );
            }
        } else if (status === 403) {
            message =
                error.response.data?.detail ||
                "You do not have permission to perform this action.";
        } else if (status === 404) {
            message =
                error.response.data?.detail ||
                "The requested resource was not found.";
        } else if (status >= 500) {
            message =
                "VaultX server error. Please try again later.";
        } else if (
            error.response.data?.detail
        ) {
            message =
                error.response.data.detail;
        }

        error.vaultxMessage =
            message;

        return Promise.reject(error);
    }
);

export default api;