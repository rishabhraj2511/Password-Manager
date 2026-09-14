/* =========================================================
   VAULTX CONTENT SCRIPT
   Login Autofill + Gmail OTP Autofill
   ========================================================= */

"use strict";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentCredentials = [];
let checkInProgress = false;
let otpCheckInProgress = false;

let lastOtpFilled = "";
let lastOtpFillTime = 0;


/* =========================================================
   PAGE INFORMATION
   ========================================================= */

function getPageInfo() {
    return {
        url: window.location.href,
        title: document.title,
        hostname: window.location.hostname,
        pathname: window.location.pathname
    };
}


/* =========================================================
   NATIVE VALUE SETTER
   Works better with Angular/React controlled inputs
   ========================================================= */

function setNativeValue(element, value) {
    if (!element) {
        return false;
    }

    const stringValue = String(value ?? "");

    const prototype =
        Object.getPrototypeOf(element);

    const descriptor =
        Object.getOwnPropertyDescriptor(
            prototype,
            "value"
        );

    if (
        descriptor &&
        typeof descriptor.set === "function"
    ) {
        descriptor.set.call(
            element,
            stringValue
        );
    } else {
        element.value = stringValue;
    }

    return true;
}


/* =========================================================
   DISPATCH INPUT EVENTS
   ========================================================= */

function dispatchInputEvents(element, value) {
    if (!element) {
        return;
    }

    const digit = String(value ?? "");

    try {
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: digit
            })
        );
    } catch (error) {
        element.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );
    }

    element.dispatchEvent(
        new Event("change", {
            bubbles: true
        })
    );

    element.dispatchEvent(
        new Event("blur", {
            bubbles: true
        })
    );
}


/* =========================================================
   DISPATCH KEYBOARD EVENTS
   ========================================================= */

function dispatchKeyboardEvents(element, value) {
    if (!element) {
        return;
    }

    const digit = String(value ?? "");

    if (!digit) {
        return;
    }

    const keyCode =
        digit >= "0" && digit <= "9"
            ? Number(digit)
            : 0;

    element.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: digit,
            code: `Digit${digit}`,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        })
    );

    element.dispatchEvent(
        new KeyboardEvent("keypress", {
            key: digit,
            code: `Digit${digit}`,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        })
    );

    element.dispatchEvent(
        new KeyboardEvent("keyup", {
            key: digit,
            code: `Digit${digit}`,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        })
    );
}


/* =========================================================
   CHECK WHETHER ELEMENT IS VISIBLE
   ========================================================= */

function isVisibleElement(element) {
    if (!element) {
        return false;
    }

    const rect =
        element.getBoundingClientRect();

    const style =
        window.getComputedStyle(element);

    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
    );
}


/* =========================================================
   FIND USERNAME FIELD
   ========================================================= */

function findUsernameField() {
    const inputs =
        Array.from(
            document.querySelectorAll("input")
        );

    return (
        inputs.find((input) => {
            const type =
                (input.type || "").toLowerCase();

            const name =
                (input.name || "").toLowerCase();

            const id =
                (input.id || "").toLowerCase();

            const autocomplete =
                (input.autocomplete || "").toLowerCase();

            const placeholder =
                (input.placeholder || "").toLowerCase();

            const ariaLabel =
                (
                    input.getAttribute("aria-label") ||
                    ""
                ).toLowerCase();

            const combined =
                `${type} ${name} ${id} ${autocomplete} ${placeholder} ${ariaLabel}`;

            const isPassword =
                type === "password";

            if (isPassword) {
                return false;
            }

            return (
                type === "email" ||
                autocomplete === "username" ||
                combined.includes("username") ||
                combined.includes("user name") ||
                combined.includes("user_id") ||
                combined.includes("userid") ||
                combined.includes("user id") ||
                combined.includes("email") ||
                combined.includes("login")
            );
        }) || null
    );
}


/* =========================================================
   FIND PASSWORD FIELD
   ========================================================= */

function findPasswordField() {
    return (
        document.querySelector(
            'input[type="password"]'
        ) || null
    );
}


/* =========================================================
   DETECT LOGIN FIELDS
   ========================================================= */

function detectLoginFields() {
    const usernameField =
        findUsernameField();

    const passwordField =
        findPasswordField();

    return {
        usernameFields: usernameField ? 1 : 0,
        passwordFields: passwordField ? 1 : 0,
        usernameField,
        passwordField
    };
}


/* =========================================================
   FILL LOGIN CREDENTIALS
   ========================================================= */

function fillCredential(username, password) {
    const usernameField =
        findUsernameField();

    const passwordField =
        findPasswordField();

    let usernameFilled = false;
    let passwordFilled = false;

    if (
        usernameField &&
        username !== undefined &&
        username !== null
    ) {
        setNativeValue(
            usernameField,
            username
        );

        dispatchInputEvents(
            usernameField,
            username
        );

        usernameFilled = true;
    }

    if (
        passwordField &&
        password !== undefined &&
        password !== null
    ) {
        setNativeValue(
            passwordField,
            password
        );

        dispatchInputEvents(
            passwordField,
            password
        );

        passwordFilled = true;
    }

    console.log(
        "VaultX credential autofill result:",
        {
            usernameFilled,
            passwordFilled
        }
    );

    return (
        usernameFilled &&
        passwordFilled
    );
}


/* =========================================================
   DETECT OTP FIELDS
   Exact KIET selector:
   input.otp-input
   ========================================================= */

function detectOtpFields() {
    /*
     * First priority:
     * KIET's exact OTP input class.
     */

    const exactOtpFields =
        Array.from(
            document.querySelectorAll(
                "input.otp-input"
            )
        ).filter((input) => {
            return (
                isVisibleElement(input) &&
                !input.disabled &&
                !input.readOnly
            );
        });

    if (exactOtpFields.length > 0) {
        return exactOtpFields.sort(
            sortOtpFields
        );
    }

    /*
     * Second priority:
     * IDs such as otp-0, otp-1, etc.
     */

    const idOtpFields =
        Array.from(
            document.querySelectorAll(
                'input[id^="otp-"]'
            )
        ).filter((input) => {
            return (
                isVisibleElement(input) &&
                !input.disabled &&
                !input.readOnly
            );
        });

    if (idOtpFields.length > 0) {
        return idOtpFields.sort(
            sortOtpFields
        );
    }

    /*
     * Fallback detection for other OTP designs.
     */

    const allInputs =
        Array.from(
            document.querySelectorAll("input")
        );

    const fallbackFields =
        allInputs.filter((input) => {
            if (!isVisibleElement(input)) {
                return false;
            }

            if (input.disabled || input.readOnly) {
                return false;
            }

            const type =
                (input.type || "").toLowerCase();

            const id =
                (input.id || "").toLowerCase();

            const name =
                (input.name || "").toLowerCase();

            const className =
                String(input.className || "")
                    .toLowerCase();

            const autocomplete =
                (input.autocomplete || "").toLowerCase();

            const inputMode =
                (input.inputMode || "").toLowerCase();

            const placeholder =
                (input.placeholder || "").toLowerCase();

            const combined =
                `${id} ${name} ${className} ${autocomplete} ${placeholder}`;

            const hasOtpKeyword =
                combined.includes("otp") ||
                combined.includes("one-time") ||
                combined.includes("onetime") ||
                combined.includes("verification") ||
                combined.includes("verify") ||
                combined.includes("passcode") ||
                combined.includes("security code");

            const isNumeric =
                type === "number" ||
                type === "tel" ||
                inputMode === "numeric";

            const maxLength =
                Number(input.maxLength);

            const isShortInput =
                maxLength === 1 ||
                (
                    maxLength > 0 &&
                    maxLength <= 8
                );

            return (
                hasOtpKeyword ||
                (
                    isNumeric &&
                    isShortInput
                )
            );
        });

    return [
        ...new Set(
            fallbackFields
        )
    ].sort(sortOtpFields);
}


/* =========================================================
   SORT OTP FIELDS
   otp-0, otp-1, otp-2...
   ========================================================= */

function sortOtpFields(a, b) {
    const aId =
        String(a.id || "");

    const bId =
        String(b.id || "");

    const aMatch =
        aId.match(/(\d+)$/);

    const bMatch =
        bId.match(/(\d+)$/);

    if (aMatch && bMatch) {
        return (
            Number(aMatch[1]) -
            Number(bMatch[1])
        );
    }

    if (aMatch) {
        return -1;
    }

    if (bMatch) {
        return 1;
    }

    const aRect =
        a.getBoundingClientRect();

    const bRect =
        b.getBoundingClientRect();

    return (
        aRect.left -
        bRect.left
    );
}


/* =========================================================
   FILL ONE OTP FIELD
   ========================================================= */

function fillSingleOtpField(field, digit) {
    if (!field) {
        return;
    }

    field.focus();

    setNativeValue(
        field,
        digit
    );

    dispatchInputEvents(
        field,
        digit
    );

    dispatchKeyboardEvents(
        field,
        digit
    );
}


/* =========================================================
   FILL OTP
   ========================================================= */

function fillOtp(otp) {
    if (
        otp === undefined ||
        otp === null
    ) {
        console.warn(
            "VaultX: OTP is empty."
        );

        return false;
    }

    const cleanOtp =
        String(otp)
            .replace(/\D/g, "")
            .slice(0, 6);

    if (
        cleanOtp.length !== 6
    ) {
        console.warn(
            "VaultX: OTP must contain exactly 6 digits.",
            otp
        );

        return false;
    }

    /*
     * Prevent duplicate fill caused by
     * background.js and response callback
     * both sending the OTP.
     */

    const currentTime =
        Date.now();

    if (
        lastOtpFilled === cleanOtp &&
        currentTime - lastOtpFillTime < 1500
    ) {
        console.log(
            "VaultX: Duplicate OTP fill ignored."
        );

        return true;
    }

    const otpFields =
        detectOtpFields();

    console.log(
        "VaultX: OTP fields found:",
        otpFields.length,
        otpFields.map((field) => ({
            id: field.id,
            className: field.className,
            value: field.value
        }))
    );

    if (
        otpFields.length < 6
    ) {
        console.warn(
            "VaultX: Six OTP fields not found.",
            {
                required: 6,
                found: otpFields.length
            }
        );

        return false;
    }

    const fieldsToFill =
        otpFields.slice(0, 6);

    fieldsToFill.forEach(
        (field, index) => {
            fillSingleOtpField(
                field,
                cleanOtp[index]
            );
        }
    );

    /*
     * Focus the last OTP field.
     * This prevents the page from losing
     * the OTP input focus.
     */

    const lastField =
        fieldsToFill[5];

    if (lastField) {
        lastField.focus();
    }

    lastOtpFilled = cleanOtp;
    lastOtpFillTime = currentTime;

    /*
     * Verify values after a short delay.
     */

    setTimeout(() => {
        const finalValues =
            fieldsToFill
                .map((field) => field.value)
                .join("");

        console.log(
            "VaultX: OTP values after filling:",
            finalValues
        );

        if (finalValues === cleanOtp) {
            console.log(
                "VaultX: OTP filled successfully:",
                cleanOtp
            );
        } else {
            console.warn(
                "VaultX: OTP values do not match after filling.",
                {
                    expected: cleanOtp,
                    actual: finalValues
                }
            );
        }
    }, 200);

    return true;
}


/* =========================================================
   WAIT FOR OTP FIELDS
   OTP modal may load dynamically
   ========================================================= */

function waitForOtpFields(
    attempts = 12,
    delay = 250
) {
    return new Promise((resolve) => {
        let count = 0;

        const check = () => {
            const fields =
                detectOtpFields();

            if (fields.length >= 6) {
                resolve(fields);
                return;
            }

            count++;

            if (count >= attempts) {
                resolve(fields);
                return;
            }

            setTimeout(
                check,
                delay
            );
        };

        check();
    });
}


/* =========================================================
   MESSAGE LISTENER
   ========================================================= */

chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
        if (
            message?.type ===
            "VAULTX_GET_PAGE_INFO"
        ) {
            sendResponse({
                ...getPageInfo(),
                fields: detectLoginFields(),
                otpFields: detectOtpFields().length
            });

            return true;
        }

        if (
            message?.type ===
            "VAULTX_SHOW_MATCHES"
        ) {
            currentCredentials =
                Array.isArray(
                    message.credentials
                )
                    ? message.credentials
                    : [];

            showVaultXMatches(
                currentCredentials
            );

            sendResponse({
                success: true
            });

            return true;
        }

        if (
            message?.type ===
            "VAULTX_FILL_CREDENTIAL"
        ) {
            const success =
                fillCredential(
                    message.username,
                    message.password
                );

            sendResponse({
                success
            });

            return true;
        }

        if (
            message?.type ===
            "VAULTX_FILL_OTP"
        ) {
            console.log(
                "VaultX: OTP fill message received:",
                message.otp
            );

            const success =
                fillOtp(message.otp);

            sendResponse({
                success
            });

            return true;
        }

        return false;
    }
);


/* =========================================================
   REMOVE VAULTX UI
   ========================================================= */

function removeVaultXUI() {
    const container =
        document.getElementById(
            "vaultx-autofill-container"
        );

    if (container) {
        container.remove();
    }
}


/* =========================================================
   CREATE BASE CONTAINER
   ========================================================= */

function createBaseContainer() {
    removeVaultXUI();

    const container =
        document.createElement("div");

    container.id =
        "vaultx-autofill-container";

    Object.assign(
        container.style,
        {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "2147483647",
            width: "300px",
            boxSizing: "border-box",
            padding: "12px",
            borderRadius: "10px",
            background: "#1f1f1f",
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            boxShadow:
                "0 8px 25px rgba(0, 0, 0, 0.45)",
            border: "1px solid #383838"
        }
    );

    return container;
}


/* =========================================================
   HEADER
   ========================================================= */

function createVaultXHeader() {
    const header =
        document.createElement("div");

    Object.assign(
        header.style,
        {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px"
        }
    );

    const title =
        document.createElement("div");

    title.textContent =
        "🔐 VaultX";

    Object.assign(
        title.style,
        {
            fontSize: "16px",
            fontWeight: "700"
        }
    );

    const closeButton =
        document.createElement("button");

    closeButton.type =
        "button";

    closeButton.textContent =
        "×";

    Object.assign(
        closeButton.style,
        {
            border: "none",
            background: "transparent",
            color: "#9ca3af",
            fontSize: "22px",
            cursor: "pointer",
            padding: "0",
            lineHeight: "1"
        }
    );

    closeButton.addEventListener(
        "click",
        () => {
            removeVaultXUI();
        }
    );

    header.appendChild(title);
    header.appendChild(closeButton);

    return header;
}


/* =========================================================
   SHOW OTP BUTTON
   ========================================================= */

function showOtpButtonIfNeeded() {
    const otpFields =
        detectOtpFields();

    if (
        otpFields.length === 0
    ) {
        return;
    }

    const existingContainer =
        document.getElementById(
            "vaultx-autofill-container"
        );

    if (existingContainer) {
        return;
    }

    const container =
        createBaseContainer();

    container.appendChild(
        createVaultXHeader()
    );

    appendOtpButton(
        container
    );

    document.body.appendChild(
        container
    );
}


/* =========================================================
   APPEND OTP BUTTON
   ========================================================= */

function appendOtpButton(container) {
    const otpSection =
        document.createElement("div");

    Object.assign(
        otpSection.style,
        {
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px solid #383838"
        }
    );

    const otpTitle =
        document.createElement("div");

    otpTitle.textContent =
        "📩 Gmail OTP";

    Object.assign(
        otpTitle.style,
        {
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "7px"
        }
    );

    const otpButton =
        document.createElement("button");

    otpButton.type =
        "button";

    otpButton.textContent =
        "Get Latest OTP";

    Object.assign(
        otpButton.style,
        {
            width: "100%",
            padding: "9px",
            border: "none",
            borderRadius: "6px",
            background: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "600",
            fontFamily: "inherit"
        }
    );

    otpButton.addEventListener(
        "mouseenter",
        () => {
            if (!otpButton.disabled) {
                otpButton.style.background =
                    "#1d4ed8";
            }
        }
    );

    otpButton.addEventListener(
        "mouseleave",
        () => {
            if (!otpButton.disabled) {
                otpButton.style.background =
                    "#2563eb";
            }
        }
    );

    otpButton.addEventListener(
        "click",
        async () => {
            if (otpCheckInProgress) {
                return;
            }

            otpCheckInProgress = true;

            otpButton.disabled = true;
            otpButton.textContent =
                "Fetching OTP...";

            console.log(
                "VaultX: Get Latest OTP button clicked."
            );

            /*
             * Confirm OTP fields before fetching.
             */

            const fieldsBeforeFetch =
                await waitForOtpFields();

            if (
                fieldsBeforeFetch.length < 6
            ) {
                console.warn(
                    "VaultX: OTP fields are not ready.",
                    fieldsBeforeFetch.length
                );
            }

            chrome.runtime.sendMessage(
                {
                    type:
                        "VAULTX_GET_LATEST_OTP"
                },
                async (response) => {
                    otpCheckInProgress = false;
                    otpButton.disabled = false;

                    if (
                        chrome.runtime.lastError
                    ) {
                        console.error(
                            "VaultX OTP message error:",
                            chrome.runtime.lastError.message
                        );

                        otpButton.textContent =
                            "❌ OTP fetch failed";

                        resetOtpButtonText(
                            otpButton,
                            2200
                        );

                        return;
                    }

                    console.log(
                        "VaultX: Background OTP response:",
                        response
                    );

                    if (
                        !response?.success
                    ) {
                        otpButton.textContent =
                            "❌ " +
                            (
                                response?.error ||
                                "OTP fetch failed"
                            );

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    if (
                        !response.otp
                    ) {
                        otpButton.textContent =
                            "No recent OTP found";

                        resetOtpButtonText(
                            otpButton,
                            2000
                        );

                        return;
                    }

                    /*
                     * Fill directly from response also.
                     * This makes content.js independent
                     * of whether background.js sends
                     * a second VAULTX_FILL_OTP message.
                     */

                    const otpFields =
                        await waitForOtpFields(
                            15,
                            250
                        );

                    if (
                        otpFields.length < 6
                    ) {
                        otpButton.textContent =
                            "❌ OTP fields not found";

                        console.error(
                            "VaultX: OTP fields unavailable after fetch.",
                            otpFields.length
                        );

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    const filled =
                        fillOtp(
                            response.otp
                        );

                    if (!filled) {
                        otpButton.textContent =
                            "❌ OTP filling failed";

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    otpButton.textContent =
                        "✓ OTP filled";

                    otpButton.style.background =
                        "#166534";

                    setTimeout(
                        () => {
                            otpButton.textContent =
                                "Get Latest OTP";

                            otpButton.style.background =
                                "#2563eb";
                        },
                        2000
                    );
                }
            );
        }
    );

    otpSection.appendChild(
        otpTitle
    );

    otpSection.appendChild(
        otpButton
    );

    container.appendChild(
        otpSection
    );
}


/* =========================================================
   RESET OTP BUTTON
   ========================================================= */

function resetOtpButtonText(button, delay) {
    setTimeout(
        () => {
            if (!button) {
                return;
            }

            button.disabled = false;

            button.textContent =
                "Get Latest OTP";

            button.style.background =
                "#2563eb";
        },
        delay
    );
}


/* =========================================================
   SHOW VAULTX CREDENTIAL MATCHES
   ========================================================= */

function showVaultXMatches(credentials) {
    if (
        !credentials ||
        credentials.length === 0
    ) {
        showOtpButtonIfNeeded();
        return;
    }

    const container =
        createBaseContainer();

    container.appendChild(
        createVaultXHeader()
    );

    const accountCount =
        document.createElement("div");

    accountCount.textContent =
        `${credentials.length} account${credentials.length > 1 ? "s" : ""}`;

    Object.assign(
        accountCount.style,
        {
            fontSize: "12px",
            color: "#a3a3a3",
            marginBottom: "10px"
        }
    );

    container.appendChild(
        accountCount
    );

    const list =
        document.createElement("div");

    Object.assign(
        list.style,
        {
            display: "flex",
            flexDirection: "column",
            gap: "8px"
        }
    );

    credentials.forEach(
        (credential) => {
            const accountButton =
                document.createElement("button");

            accountButton.type =
                "button";

            Object.assign(
                accountButton.style,
                {
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderLeft:
                        "3px solid transparent",
                    borderRadius: "6px",
                    background: "#242424",
                    color: "#ffffff",
                    padding: "10px",
                    cursor: "pointer",
                    fontFamily: "inherit"
                }
            );

            const username =
                document.createElement("div");

            username.textContent =
                credential.username ||
                credential.title ||
                "Saved account";

            Object.assign(
                username.style,
                {
                    fontSize: "13px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }
            );

            const password =
                document.createElement("div");

            password.textContent =
                "••••••••••••••";

            Object.assign(
                password.style,
                {
                    fontSize: "11px",
                    color: "#d4d4d4",
                    letterSpacing: "1px",
                    marginTop: "3px"
                }
            );

            accountButton.appendChild(
                username
            );

            accountButton.appendChild(
                password
            );

            accountButton.addEventListener(
                "mouseenter",
                () => {
                    accountButton.style.background =
                        "#303030";

                    accountButton.style.borderLeftColor =
                        "#22c55e";
                }
            );

            accountButton.addEventListener(
                "mouseleave",
                () => {
                    accountButton.style.background =
                        "#242424";

                    accountButton.style.borderLeftColor =
                        "transparent";
                }
            );

            accountButton.addEventListener(
                "click",
                () => {
                    fillSelectedCredential(
                        credential,
                        accountButton,
                        list
                    );
                }
            );

            list.appendChild(
                accountButton
            );
        }
    );

    container.appendChild(
        list
    );

    document.body.appendChild(
        container
    );

    appendOtpButton(
        container
    );

    console.log(
        "VaultX matching credentials found:",
        credentials.length
    );
}


/* =========================================================
   FILL SELECTED CREDENTIAL
   ========================================================= */

function fillSelectedCredential(
    credential,
    button,
    list
) {
    if (
        !credential?.id
    ) {
        console.warn(
            "VaultX: Credential ID missing."
        );

        return;
    }

    const buttons =
        Array.from(
            list.querySelectorAll("button")
        );

    buttons.forEach(
        (item) => {
            item.disabled = true;
            item.style.opacity = "0.6";
            item.style.cursor = "default";
        }
    );

    button.style.opacity = "1";
    button.style.background = "#303030";
    button.textContent = "🔐 Filling...";

    chrome.runtime.sendMessage(
        {
            type:
                "VAULTX_AUTOFILL",

            credentialId:
                credential.id,

            username:
                credential.username || ""
        },
        (response) => {
            if (
                chrome.runtime.lastError
            ) {
                console.error(
                    "VaultX autofill error:",
                    chrome.runtime.lastError.message
                );

                button.textContent =
                    "❌ Autofill failed";

                resetAccountButtons(
                    buttons
                );

                return;
            }

            if (
                !response?.success
            ) {
                console.error(
                    "VaultX autofill failed:",
                    response?.error
                );

                button.textContent =
                    "❌ Autofill failed";

                setTimeout(
                    () => {
                        resetAccountButtons(
                            buttons
                        );
                    },
                    1800
                );

                return;
            }

            button.textContent =
                "✓ Filled successfully";

            button.style.background =
                "#166534";

            button.style.borderLeftColor =
                "#22c55e";

            setTimeout(
                () => {
                    removeVaultXUI();
                },
                1200
            );
        }
    );
}


/* =========================================================
   RESET ACCOUNT BUTTONS
   ========================================================= */

function resetAccountButtons(buttons) {
    buttons.forEach(
        (button, index) => {
            button.disabled = false;
            button.style.opacity = "1";
            button.style.cursor = "pointer";
            button.style.background = "#242424";
            button.style.borderLeftColor =
                "transparent";

            const credential =
                currentCredentials[index];

            if (!credential) {
                return;
            }

            button.textContent =
                credential.username ||
                credential.title ||
                "Saved account";
        }
    );
}


/* =========================================================
   REQUEST CREDENTIAL CHECK
   ========================================================= */

function requestCredentialCheck() {
    if (checkInProgress) {
        return;
    }

    if (!document.body) {
        return;
    }

    checkInProgress = true;

    chrome.runtime.sendMessage(
        {
            type:
                "VAULTX_CHECK_PAGE"
        },
        (response) => {
            checkInProgress = false;

            if (
                chrome.runtime.lastError
            ) {
                console.error(
                    "VaultX page check error:",
                    chrome.runtime.lastError.message
                );

                return;
            }

            console.log(
                "VaultX page check:",
                response
            );

            if (
                response?.credentials &&
                response.credentials.length > 0
            ) {
                showVaultXMatches(
                    response.credentials
                );

                return;
            }

            showOtpButtonIfNeeded();
        }
    );
}


/* =========================================================
   WATCH DYNAMIC PAGE CHANGES
   ========================================================= */

function watchDynamicLoginForms() {
    if (!document.documentElement) {
        return;
    }

    const observer =
        new MutationObserver(
            () => {
                clearTimeout(
                    window.__vaultxCheckTimer
                );

                window.__vaultxCheckTimer =
                    setTimeout(
                        () => {
                            const loginFields =
                                detectLoginFields();

                            const otpFields =
                                detectOtpFields();

                            if (
                                (
                                    loginFields.usernameFields > 0 &&
                                    loginFields.passwordFields > 0
                                ) ||
                                otpFields.length > 0
                            ) {
                                requestCredentialCheck();
                            }
                        },
                        700
                    );
            }
        );

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                "type",
                "name",
                "id",
                "class",
                "autocomplete",
                "placeholder",
                "aria-label",
                "inputmode",
                "disabled",
                "readonly"
            ]
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeVaultX() {
    console.log(
        "VaultX content.js initialized.",
        getPageInfo()
    );

    requestCredentialCheck();

    watchDynamicLoginForms();
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initializeVaultX,
        {
            once: true
        }
    );
} else {
    initializeVaultX();
}