"use strict";

/* =========================================================
   VAULTX CONTENT SCRIPT
   Credential Autofill + OTP Autofill
   ========================================================= */

let currentCredentials = [];
let checkInProgress = false;
let otpCheckInProgress = false;

let lastOtpFilled = "";
let lastOtpFillTime = 0;

const VAULTX_CONTAINER_ID =
    "vaultx-autofill-container";

const VAULTX_OTP_SECTION_ID =
    "vaultx-otp-section";


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
   ELEMENT VISIBILITY
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
   REACT/ANGULAR NATIVE VALUE SETTER
   ========================================================= */

function setNativeValue(element, value) {
    if (!element) {
        return false;
    }

    const stringValue =
        String(value ?? "");

    try {
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
    } catch (error) {
        element.value = stringValue;
    }

    return true;
}


/* =========================================================
   INPUT EVENTS
   ========================================================= */

function dispatchInputEvents(element, value) {
    if (!element) {
        return;
    }

    const stringValue =
        String(value ?? "");

    try {
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: stringValue
            })
        );
    } catch (error) {
        element.dispatchEvent(
            new Event("input", {
                bubbles: true,
                cancelable: true
            })
        );
    }

    element.dispatchEvent(
        new Event("change", {
            bubbles: true,
            cancelable: true
        })
    );
}


/* =========================================================
   KEYBOARD EVENTS
   ========================================================= */

function dispatchKeyboardEvents(element, value) {
    if (!element) {
        return;
    }

    const digit =
        String(value ?? "");

    if (!digit) {
        return;
    }

    const keyCode =
        digit >= "0" && digit <= "9"
            ? Number(digit)
            : 0;

    try {
        element.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: digit,
                code:
                    digit >= "0" && digit <= "9"
                        ? `Digit${digit}`
                        : "",
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            })
        );

        element.dispatchEvent(
            new KeyboardEvent("keypress", {
                key: digit,
                code:
                    digit >= "0" && digit <= "9"
                        ? `Digit${digit}`
                        : "",
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            })
        );

        element.dispatchEvent(
            new KeyboardEvent("keyup", {
                key: digit,
                code:
                    digit >= "0" && digit <= "9"
                        ? `Digit${digit}`
                        : "",
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            })
        );
    } catch (error) {
        console.warn(
            "VaultX keyboard event error:",
            error
        );
    }
}


/* =========================================================
   USERNAME FIELD
   ========================================================= */

function findUsernameField() {
    const inputs =
        Array.from(
            document.querySelectorAll("input")
        );

    return (
        inputs.find((input) => {
            const type =
                String(input.type || "")
                    .toLowerCase();

            const name =
                String(input.name || "")
                    .toLowerCase();

            const id =
                String(input.id || "")
                    .toLowerCase();

            const autocomplete =
                String(input.autocomplete || "")
                    .toLowerCase();

            const placeholder =
                String(input.placeholder || "")
                    .toLowerCase();

            const ariaLabel =
                String(
                    input.getAttribute(
                        "aria-label"
                    ) || ""
                ).toLowerCase();

            if (type === "password") {
                return false;
            }

            const combined =
                `${type} ${name} ${id} ${autocomplete} ${placeholder} ${ariaLabel}`;

            return (
                type === "email" ||
                autocomplete === "username" ||
                combined.includes("username") ||
                combined.includes("user name") ||
                combined.includes("userid") ||
                combined.includes("user_id") ||
                combined.includes("user id") ||
                combined.includes("email") ||
                combined.includes("login")
            );
        }) || null
    );
}


/* =========================================================
   PASSWORD FIELD
   ========================================================= */

function findPasswordField() {
    const passwordFields =
        Array.from(
            document.querySelectorAll(
                'input[type="password"]'
            )
        );

    return (
        passwordFields.find(
            (field) =>
                isVisibleElement(field) &&
                !field.disabled &&
                !field.readOnly
        ) || null
    );
}


/* =========================================================
   LOGIN FIELD DETECTION
   ========================================================= */

function detectLoginFields() {
    const usernameField =
        findUsernameField();

    const passwordField =
        findPasswordField();

    return {
        usernameFields:
            usernameField ? 1 : 0,

        passwordFields:
            passwordField ? 1 : 0,

        usernameField,
        passwordField
    };
}


/* =========================================================
   ACTUAL LOGIN PAGE CHECK
   Prevent popup on already logged-in GitHub dashboard
   ========================================================= */

function isActualLoginPage() {
    const loginFields =
        detectLoginFields();

    const hasUsername =
        loginFields.usernameFields > 0;

    const hasPassword =
        loginFields.passwordFields > 0;

    if (
        hasUsername &&
        hasPassword
    ) {
        return true;
    }

    /*
     * Additional login page indicators.
     * These are only used when a real login form
     * is present somewhere in the page.
     */

    const loginForm =
        document.querySelector(
            'form[action*="login" i], form[id*="login" i], form[class*="login" i]'
        );

    if (
        loginForm &&
        isVisibleElement(loginForm)
    ) {
        const passwordInsideForm =
            loginForm.querySelector(
                'input[type="password"]'
            );

        if (
            passwordInsideForm &&
            isVisibleElement(passwordInsideForm)
        ) {
            return true;
        }
    }

    return false;
}


/* =========================================================
   CREDENTIAL FILLING
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
        usernameField.focus();

        setNativeValue(
            usernameField,
            username
        );

        dispatchInputEvents(
            usernameField,
            username
        );

        usernameField.blur();

        usernameFilled = true;
    }

    if (
        passwordField &&
        password !== undefined &&
        password !== null
    ) {
        passwordField.focus();

        setNativeValue(
            passwordField,
            password
        );

        dispatchInputEvents(
            passwordField,
            password
        );

        passwordField.blur();

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
   OTP FIELD SORTING
   ========================================================= */

function sortOtpFields(a, b) {
    const aText =
        `${a.id || ""} ${a.name || ""} ${a.className || ""}`;

    const bText =
        `${b.id || ""} ${b.name || ""} ${b.className || ""}`;

    const aMatch =
        aText.match(/(\d+)$/);

    const bMatch =
        bText.match(/(\d+)$/);

    if (
        aMatch &&
        bMatch
    ) {
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

    if (
        aRect.top !==
        bRect.top
    ) {
        return (
            aRect.top -
            bRect.top
        );
    }

    return (
        aRect.left -
        bRect.left
    );
}


/* =========================================================
   OTP FIELD DETECTION
   ========================================================= */

function detectOtpFields() {
    const allInputs =
        Array.from(
            document.querySelectorAll("input")
        );

    const visibleInputs =
        allInputs.filter((input) => {
            return (
                isVisibleElement(input) &&
                !input.disabled &&
                !input.readOnly
            );
        });

    /*
     * 1. Exact OTP class
     */

    const exactClassFields =
        visibleInputs.filter((input) => {
            return input.matches(
                "input.otp-input"
            );
        });

    if (
        exactClassFields.length > 0
    ) {
        return exactClassFields.sort(
            sortOtpFields
        );
    }

    /*
     * 2. Exact OTP IDs
     * otp-0, otp-1, otp-2...
     */

    const exactIdFields =
        visibleInputs.filter((input) => {
            return (
                input.id.startsWith("otp-") ||
                input.id.startsWith("otp_")
            );
        });

    if (
        exactIdFields.length > 0
    ) {
        return exactIdFields.sort(
            sortOtpFields
        );
    }

    /*
     * 3. OTP-related names, IDs and classes
     */

    const keywordFields =
        visibleInputs.filter((input) => {
            const type =
                String(input.type || "")
                    .toLowerCase();

            const name =
                String(input.name || "")
                    .toLowerCase();

            const id =
                String(input.id || "")
                    .toLowerCase();

            const className =
                String(input.className || "")
                    .toLowerCase();

            const autocomplete =
                String(input.autocomplete || "")
                    .toLowerCase();

            const placeholder =
                String(input.placeholder || "")
                    .toLowerCase();

            const ariaLabel =
                String(
                    input.getAttribute(
                        "aria-label"
                    ) || ""
                ).toLowerCase();

            const combined =
                `${type} ${name} ${id} ${className} ${autocomplete} ${placeholder} ${ariaLabel}`;

            return (
                combined.includes("otp") ||
                combined.includes("one-time") ||
                combined.includes("one time") ||
                combined.includes("verification code") ||
                combined.includes("verification") ||
                combined.includes("security code") ||
                combined.includes("authentication code") ||
                combined.includes("auth code") ||
                combined.includes("passcode") ||
                combined.includes("login code")
            );
        });

    if (
        keywordFields.length > 0
    ) {
        return keywordFields.sort(
            sortOtpFields
        );
    }

    /*
     * 4. Six separate one-character numeric boxes
     */

    const separateOtpBoxes =
        visibleInputs.filter((input) => {
            const type =
                String(input.type || "")
                    .toLowerCase();

            const inputMode =
                String(input.inputMode || "")
                    .toLowerCase();

            const maxLength =
                Number(input.maxLength);

            return (
                maxLength === 1 &&
                (
                    type === "text" ||
                    type === "tel" ||
                    type === "number" ||
                    inputMode === "numeric"
                )
            );
        });

    if (
        separateOtpBoxes.length >= 4
    ) {
        return separateOtpBoxes.sort(
            sortOtpFields
        );
    }

    /*
     * 5. Single numeric OTP input
     */

    const singleOtpInputs =
        visibleInputs.filter((input) => {
            const type =
                String(input.type || "")
                    .toLowerCase();

            const inputMode =
                String(input.inputMode || "")
                    .toLowerCase();

            const maxLength =
                Number(input.maxLength);

            return (
                (
                    type === "tel" ||
                    type === "number" ||
                    inputMode === "numeric"
                ) &&
                maxLength > 1 &&
                maxLength <= 8
            );
        });

    if (
        singleOtpInputs.length > 0
    ) {
        return singleOtpInputs.sort(
            sortOtpFields
        );
    }

    return [];
}


/* =========================================================
   WAIT FOR OTP FIELDS
   ========================================================= */

async function waitForOtpFields(
    attempts = 20,
    delay = 250
) {
    for (
        let index = 0;
        index < attempts;
        index++
    ) {
        const fields =
            detectOtpFields();

        if (
            fields.length > 0
        ) {
            return fields;
        }

        await new Promise(
            (resolve) => {
                setTimeout(
                    resolve,
                    delay
                );
            }
        );
    }

    return detectOtpFields();
}


/* =========================================================
   FILL ONE OTP FIELD
   ========================================================= */

function fillSingleOtpField(
    field,
    digit
) {
    if (!field) {
        return false;
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

    return (
        String(field.value) ===
        String(digit)
    );
}


/* =========================================================
   FILL OTP
   Supports:
   - One complete OTP input
   - Six separate OTP boxes
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
            "VaultX: Invalid OTP:",
            otp
        );

        return false;
    }

    const now =
        Date.now();

    if (
        lastOtpFilled === cleanOtp &&
        now - lastOtpFillTime < 1500
    ) {
        console.log(
            "VaultX: Duplicate OTP ignored."
        );

        return true;
    }

    const fields =
        detectOtpFields();

    console.log(
        "VaultX OTP fields detected:",
        fields.length,
        fields.map((field) => ({
            id: field.id,
            name: field.name,
            className: field.className,
            maxLength: field.maxLength,
            value: field.value
        }))
    );

    if (
        fields.length === 0
    ) {
        console.warn(
            "VaultX: OTP fields not found."
        );

        return false;
    }

    /*
     * Single complete OTP input
     */

    if (
        fields.length === 1
    ) {
        const field =
            fields[0];

        field.focus();

        setNativeValue(
            field,
            cleanOtp
        );

        dispatchInputEvents(
            field,
            cleanOtp
        );

        dispatchKeyboardEvents(
            field,
            cleanOtp
        );

        field.blur();

        setTimeout(
            () => {
                if (
                    String(field.value) !==
                    cleanOtp
                ) {
                    field.focus();

                    setNativeValue(
                        field,
                        cleanOtp
                    );

                    dispatchInputEvents(
                        field,
                        cleanOtp
                    );

                    field.blur();
                }
            },
            300
        );

        lastOtpFilled =
            cleanOtp;

        lastOtpFillTime =
            now;

        console.log(
            "VaultX: OTP filled into single input."
        );

        return true;
    }

    /*
     * Six separate OTP boxes
     */

    if (
        fields.length >= 6
    ) {
        const fieldsToFill =
            fields.slice(0, 6);

        fieldsToFill.forEach(
            (field, index) => {
                fillSingleOtpField(
                    field,
                    cleanOtp[index]
                );
            }
        );

        setTimeout(
            () => {
                fieldsToFill.forEach(
                    (field, index) => {
                        if (
                            String(field.value) !==
                            cleanOtp[index]
                        ) {
                            fillSingleOtpField(
                                field,
                                cleanOtp[index]
                            );
                        }
                    }
                );
            },
            300
        );

        const lastField =
            fieldsToFill[
                fieldsToFill.length - 1
            ];

        if (lastField) {
            lastField.focus();
        }

        lastOtpFilled =
            cleanOtp;

        lastOtpFillTime =
            now;

        setTimeout(
            () => {
                const finalValue =
                    fieldsToFill
                        .map(
                            (field) =>
                                String(field.value || "")
                        )
                        .join("");

                console.log(
                    "VaultX final OTP value:",
                    finalValue
                );

                if (
                    finalValue === cleanOtp
                ) {
                    console.log(
                        "VaultX: OTP filled successfully."
                    );
                } else {
                    console.warn(
                        "VaultX: OTP verification mismatch.",
                        {
                            expected: cleanOtp,
                            actual: finalValue
                        }
                    );
                }
            },
            500
        );

        return true;
    }

    /*
     * Fallback for multiple fields
     */

    const firstField =
        fields[0];

    firstField.focus();

    setNativeValue(
        firstField,
        cleanOtp
    );

    dispatchInputEvents(
        firstField,
        cleanOtp
    );

    firstField.blur();

    lastOtpFilled =
        cleanOtp;

    lastOtpFillTime =
        now;

    console.log(
        "VaultX: OTP filled using fallback."
    );

    return true;
}


/* =========================================================
   REMOVE VAULTX UI
   ========================================================= */

function removeVaultXUI() {
    const container =
        document.getElementById(
            VAULTX_CONTAINER_ID
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
        VAULTX_CONTAINER_ID;

    Object.assign(
        container.style,
        {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "2147483647",
            width: "310px",
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
   CREATE HEADER
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
        removeVaultXUI
    );

    header.appendChild(
        title
    );

    header.appendChild(
        closeButton
    );

    return header;
}


/* =========================================================
   RESET OTP BUTTON
   ========================================================= */

function resetOtpButtonText(
    button,
    delay
) {
    setTimeout(
        () => {
            if (!button) {
                return;
            }

            button.disabled =
                false;

            button.textContent =
                "Get Latest OTP";

            button.style.background =
                "#2563eb";
        },
        delay
    );
}


/* =========================================================
   APPEND OTP SECTION
   ========================================================= */

function appendOtpButton(container) {
    if (!container) {
        return;
    }

    if (
        container.querySelector(
            `#${VAULTX_OTP_SECTION_ID}`
        )
    ) {
        return;
    }

    const otpFields =
        detectOtpFields();

    if (
        otpFields.length === 0
    ) {
        return;
    }

    const otpSection =
        document.createElement("div");

    otpSection.id =
        VAULTX_OTP_SECTION_ID;

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
            if (
                !otpButton.disabled
            ) {
                otpButton.style.background =
                    "#1d4ed8";
            }
        }
    );

    otpButton.addEventListener(
        "mouseleave",
        () => {
            if (
                !otpButton.disabled
            ) {
                otpButton.style.background =
                    "#2563eb";
            }
        }
    );

    otpButton.addEventListener(
        "click",
        async () => {
            if (
                otpCheckInProgress
            ) {
                return;
            }

            otpCheckInProgress =
                true;

            otpButton.disabled =
                true;

            otpButton.style.cursor =
                "not-allowed";

            otpButton.textContent =
                "Fetching OTP...";

            console.log(
                "VaultX: Get Latest OTP clicked."
            );

            chrome.runtime.sendMessage(
                {
                    type:
                        "VAULTX_GET_LATEST_OTP"
                },
                async (response) => {
                    otpCheckInProgress =
                        false;

                    if (
                        chrome.runtime.lastError
                    ) {
                        console.error(
                            "VaultX OTP message error:",
                            chrome.runtime.lastError.message
                        );

                        otpButton.disabled =
                            false;

                        otpButton.style.cursor =
                            "pointer";

                        otpButton.textContent =
                            "❌ OTP fetch failed";

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    console.log(
                        "VaultX OTP response:",
                        response
                    );

                    if (
                        !response?.success
                    ) {
                        otpButton.disabled =
                            false;

                        otpButton.style.cursor =
                            "pointer";

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
                        otpButton.disabled =
                            false;

                        otpButton.style.cursor =
                            "pointer";

                        otpButton.textContent =
                            "No recent OTP found";

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    const fields =
                        await waitForOtpFields(
                            20,
                            250
                        );

                    if (
                        fields.length === 0
                    ) {
                        otpButton.disabled =
                            false;

                        otpButton.style.cursor =
                            "pointer";

                        otpButton.textContent =
                            "❌ OTP field not found";

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    const success =
                        fillOtp(
                            response.otp
                        );

                    if (!success) {
                        otpButton.disabled =
                            false;

                        otpButton.style.cursor =
                            "pointer";

                        otpButton.textContent =
                            "❌ OTP filling failed";

                        resetOtpButtonText(
                            otpButton,
                            2500
                        );

                        return;
                    }

                    otpButton.disabled =
                        false;

                    otpButton.style.cursor =
                        "pointer";

                    otpButton.textContent =
                        "✓ OTP filled";

                    otpButton.style.background =
                        "#166534";

                    setTimeout(
                        () => {
                            if (
                                otpButton
                            ) {
                                otpButton.textContent =
                                    "Get Latest OTP";

                                otpButton.style.background =
                                    "#2563eb";
                            }
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
   SHOW OTP BUTTON ONLY WHEN OTP FIELD EXISTS
   ========================================================= */

function showOtpButtonIfNeeded() {
    const otpFields =
        detectOtpFields();

    if (
        otpFields.length === 0
    ) {
        return;
    }

    let container =
        document.getElementById(
            VAULTX_CONTAINER_ID
        );

    if (!container) {
        container =
            createBaseContainer();

        container.appendChild(
            createVaultXHeader()
        );

        document.body.appendChild(
            container
        );
    }

    appendOtpButton(
        container
    );
}


/* =========================================================
   SHOW SAVED CREDENTIALS
   ========================================================= */

function showVaultXMatches(credentials) {
    const safeCredentials =
        Array.isArray(credentials)
            ? credentials
            : [];

    /*
     * Never show credential popup if
     * there is no actual login form.
     */

    if (
        !isActualLoginPage()
    ) {
        console.log(
            "VaultX: No actual login page. Credential popup hidden."
        );

        showOtpButtonIfNeeded();

        return;
    }

    if (
        safeCredentials.length === 0
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
        `${safeCredentials.length} saved account${safeCredentials.length > 1 ? "s" : ""}`;

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

    safeCredentials.forEach(
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

            const row =
                document.createElement("div");

            Object.assign(
                row.style,
                {
                    display: "flex",
                    alignItems: "center",
                    gap: "9px"
                }
            );

            const icon =
                document.createElement("div");

            icon.textContent =
                "●";

            Object.assign(
                icon.style,
                {
                    width: "18px",
                    minWidth: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px"
                }
            );

            const textContainer =
                document.createElement("div");

            Object.assign(
                textContainer.style,
                {
                    minWidth: "0",
                    flex: "1"
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

            textContainer.appendChild(
                username
            );

            textContainer.appendChild(
                password
            );

            row.appendChild(
                icon
            );

            row.appendChild(
                textContainer
            );

            accountButton.appendChild(
                row
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

    /*
     * OTP section is independent from credentials.
     */

    showOtpButtonIfNeeded();
}


/* =========================================================
   SELECTED CREDENTIAL FILL
   ========================================================= */

function fillSelectedCredential(
    credential,
    button,
    list
) {
    if (
        !credential
    ) {
        return;
    }

    const buttons =
        Array.from(
            list.querySelectorAll("button")
        );

    buttons.forEach(
        (item) => {
            item.disabled =
                true;

            item.style.opacity =
                "0.6";

            item.style.cursor =
                "default";
        }
    );

    button.textContent =
        "🔐 Filling...";

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

                buttons.forEach(
                    (item) => {
                        item.disabled =
                            false;

                        item.style.opacity =
                            "1";

                        item.style.cursor =
                            "pointer";
                    }
                );

                return;
            }

            if (
                !response?.success
            ) {
                button.textContent =
                    "❌ Autofill failed";

                setTimeout(
                    () => {
                        buttons.forEach(
                            (item) => {
                                item.disabled =
                                    false;

                                item.style.opacity =
                                    "1";

                                item.style.cursor =
                                    "pointer";
                            }
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
                removeVaultXUI,
                1200
            );
        }
    );
}


/* =========================================================
   REQUEST CREDENTIAL CHECK
   ========================================================= */

function requestCredentialCheck() {
    /*
     * Do not request credential matches
     * on normal already-logged-in pages.
     */

    const actualLoginPage =
        isActualLoginPage();

    const otpFields =
        detectOtpFields();

    if (
        !actualLoginPage
    ) {
        console.log(
            "VaultX: Credential check skipped. Not a login page."
        );

        if (
            otpFields.length > 0
        ) {
            showOtpButtonIfNeeded();
        }

        return;
    }

    if (
        checkInProgress
    ) {
        return;
    }

    checkInProgress =
        true;

    chrome.runtime.sendMessage(
        {
            type:
                "VAULTX_CHECK_PAGE"
        },
        (response) => {
            checkInProgress =
                false;

            if (
                chrome.runtime.lastError
            ) {
                console.error(
                    "VaultX page check error:",
                    chrome.runtime.lastError.message
                );

                showOtpButtonIfNeeded();

                return;
            }

            console.log(
                "VaultX page check response:",
                response
            );

            if (
                response?.credentials &&
                response.credentials.length > 0
            ) {
                currentCredentials =
                    response.credentials;

                showVaultXMatches(
                    response.credentials
                );
            } else {
                showOtpButtonIfNeeded();
            }
        }
    );
}


/* =========================================================
   MESSAGE LISTENER
   IMPORTANT: Background OTP message is handled here
   ========================================================= */

chrome.runtime.onMessage.addListener(
    (
        message,
        _sender,
        sendResponse
    ) => {
        if (
            message?.type ===
            "VAULTX_GET_PAGE_INFO"
        ) {
            sendResponse({
                ...getPageInfo(),

                fields:
                    detectLoginFields(),

                isLoginPage:
                    isActualLoginPage(),

                otpFields:
                    detectOtpFields().length
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

        /*
         * THIS WAS THE IMPORTANT MISSING PART
         */

        if (
            message?.type ===
            "VAULTX_FILL_OTP"
        ) {
            console.log(
                "VaultX: OTP fill message received:",
                message.otp
            );

            const success =
                fillOtp(
                    message.otp
                );

            sendResponse({
                success
            });

            return true;
        }

        return false;
    }
);


/* =========================================================
   DYNAMIC FORM WATCHER
   ========================================================= */

function watchDynamicForms() {
    if (
        !document.documentElement
    ) {
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
                            const loginPage =
                                isActualLoginPage();

                            const otpFields =
                                detectOtpFields();

                            if (
                                loginPage
                            ) {
                                requestCredentialCheck();
                            }

                            if (
                                otpFields.length > 0
                            ) {
                                showOtpButtonIfNeeded();
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
                "maxlength",
                "disabled",
                "readonly",
                "style"
            ]
        }
    );
}


/* =========================================================
   SPA NAVIGATION WATCHER
   ========================================================= */

function watchSpaNavigation() {
    const originalPushState =
        history.pushState;

    const originalReplaceState =
        history.replaceState;

    history.pushState =
        function (...args) {
            originalPushState.apply(
                history,
                args
            );

            handleUrlChange();
        };

    history.replaceState =
        function (...args) {
            originalReplaceState.apply(
                history,
                args
            );

            handleUrlChange();
        };

    window.addEventListener(
        "popstate",
        handleUrlChange
    );

    window.addEventListener(
        "hashchange",
        handleUrlChange
    );

    window.__vaultxLastUrl =
        window.location.href;
}


/* =========================================================
   URL CHANGE HANDLER
   ========================================================= */

function handleUrlChange() {
    const currentUrl =
        window.location.href;

    if (
        window.__vaultxLastUrl ===
        currentUrl
    ) {
        return;
    }

    window.__vaultxLastUrl =
        currentUrl;

    currentCredentials =
        [];

    removeVaultXUI();

    setTimeout(
        () => {
            requestCredentialCheck();
            showOtpButtonIfNeeded();
        },
        700
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

    watchDynamicForms();

    watchSpaNavigation();

    setTimeout(
        () => {
            requestCredentialCheck();
            showOtpButtonIfNeeded();
        },
        1200
    );

    setTimeout(
        () => {
            requestCredentialCheck();
            showOtpButtonIfNeeded();
        },
        3000
    );
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