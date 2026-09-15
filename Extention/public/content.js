console.log(
    "VaultX content script loaded:",
    window.location.hostname
);

let currentCredentials = [];
let checkInProgress = false;
let otpCheckInProgress = false;
let lastCheckedUrl = window.location.href;


/* =========================================================
   PAGE INFORMATION
   ========================================================= */

function getPageInfo() {
    return {
        type: "VAULTX_PAGE_INFO",
        url: window.location.href,
        hostname: window.location.hostname,
        title: document.title
    };
}


/* =========================================================
   LOGIN FIELD DETECTION
   ========================================================= */

function detectLoginFields() {
    const inputs =
        Array.from(
            document.querySelectorAll("input")
        );

    const usernameFields =
        inputs.filter((input) => {
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

            return (
                type === "email" ||
                autocomplete === "username" ||
                name.includes("user") ||
                name.includes("email") ||
                id.includes("user") ||
                id.includes("email") ||
                id.includes("login") ||
                placeholder.includes("email") ||
                placeholder.includes("username")
            );
        });

    const passwordFields =
        inputs.filter(
            (input) =>
                (input.type || "").toLowerCase() ===
                "password"
        );

    return {
        usernameFields:
            usernameFields.length,

        passwordFields:
            passwordFields.length
    };
}


/* =========================================================
   COMMON VISIBILITY CHECK
   ========================================================= */

function isVisibleInput(input) {
    if (!input) {
        return false;
    }

    if (
        input.disabled ||
        input.readOnly
    ) {
        return false;
    }

    if (
        (input.type || "").toLowerCase() ===
        "hidden"
    ) {
        return false;
    }

    const style =
        window.getComputedStyle(input);

    if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
    ) {
        return false;
    }

    if (
        input.offsetWidth === 0 ||
        input.offsetHeight === 0
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   CHECK WHETHER ELEMENT BELONGS TO VAULTX UI
   ========================================================= */

function isVaultXElement(element) {
    if (!element) {
        return false;
    }

    return Boolean(
        element.closest(
            "#vaultx-autofill-container"
        )
    );
}


/* =========================================================
   OTP MODAL DETECTION
   ========================================================= */

function getOtpModalContainers() {
    const allElements =
        Array.from(
            document.querySelectorAll(
                "div, section, article, form, dialog"
            )
        );

    return allElements.filter((element) => {
        if (
            isVaultXElement(element)
        ) {
            return false;
        }

        const text = (
            element.innerText ||
            element.textContent ||
            ""
        ).toLowerCase();

        const hasOtpText =
            text.includes("otp verification") ||
            text.includes("enter the otp") ||
            text.includes("otp sent") ||
            text.includes("verification code") ||
            text.includes("one time password") ||
            text.includes("one-time password") ||
            text.includes("enter otp") ||
            text.includes("authentication code");

        return hasOtpText;
    });
}


/* =========================================================
   OTP FIELD DETECTION
   ========================================================= */

function detectOtpFields() {
    const inputs =
        Array.from(
            document.querySelectorAll("input")
        );

    const visibleInputs =
        inputs.filter(
            (input) =>
                isVisibleInput(input)
        );

    const otpFields =
        visibleInputs.filter((input) => {
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
                    input.getAttribute(
                        "aria-label"
                    ) || ""
                ).toLowerCase();

            const className =
                (
                    typeof input.className ===
                    "string"
                        ? input.className
                        : ""
                ).toLowerCase();

            const inputMode =
                (input.inputMode || "").toLowerCase();

            const combinedText = `
                ${name}
                ${id}
                ${autocomplete}
                ${placeholder}
                ${ariaLabel}
                ${className}
            `.toLowerCase();

            const hasOtpKeyword =
                combinedText.includes("otp") ||
                combinedText.includes("one-time") ||
                combinedText.includes("one time") ||
                combinedText.includes("verification") ||
                combinedText.includes("verify") ||
                combinedText.includes("security code") ||
                combinedText.includes("verification code") ||
                combinedText.includes("auth code") ||
                combinedText.includes("authentication code") ||
                combinedText.includes("passcode");

            const isNumericInput =
                type === "number" ||
                type === "tel" ||
                inputMode === "numeric" ||
                inputMode === "decimal";

            const maxLength =
                Number(input.maxLength);

            const isShortCode =
                maxLength > 0 &&
                maxLength <= 8;

            const isSingleOtpBox =
                maxLength === 1;

            return (
                hasOtpKeyword ||
                isSingleOtpBox ||
                (
                    isNumericInput &&
                    isShortCode
                )
            );
        });

    /*
     * Some college websites use six separate
     * one-character OTP input boxes.
     */
    const separateOtpBoxes =
        visibleInputs.filter((input) => {
            const id =
                (input.id || "").toLowerCase();

            const className =
                (
                    typeof input.className ===
                    "string"
                        ? input.className
                        : ""
                ).toLowerCase();

            const maxLength =
                Number(input.maxLength);

            return (
                maxLength === 1 &&
                (
                    id.includes("otp") ||
                    className.includes("otp") ||
                    id.startsWith("otp-") ||
                    className.includes("verification")
                )
            );
        });

    if (
        separateOtpBoxes.length >= 4
    ) {
        return separateOtpBoxes;
    }

    return otpFields;
}


/* =========================================================
   WAIT FOR OTP FIELDS
   ========================================================= */

async function waitForOtpFields(
    attempts = 15,
    delay = 250
) {
    for (
        let index = 0;
        index < attempts;
        index++
    ) {
        const otpFields =
            detectOtpFields();

        if (
            otpFields.length > 0
        ) {
            return otpFields;
        }

        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    delay
                )
        );
    }

    return detectOtpFields();
}


/* =========================================================
   MESSAGE LISTENER
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

        if (
            message?.type ===
            "VAULTX_FILL_OTP"
        ) {
            console.log(
                "VaultX: OTP fill message received."
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
   CREATE VAULTX HEADER
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
   SHOW OTP BUTTON IF NEEDED
   ========================================================= */

function showOtpButtonIfNeeded() {
    const otpFields =
        detectOtpFields();

    if (
        otpFields.length === 0
    ) {
        removeVaultXUI();
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
    /*
     * Avoid adding the OTP section twice.
     */
    if (
        container.querySelector(
            "[data-vaultx-otp-section='true']"
        )
    ) {
        return;
    }

    const otpSection =
        document.createElement("div");

    otpSection.dataset.vaultxOtpSection =
        "true";

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
                "VaultX: Get Latest OTP button clicked."
            );

            chrome.runtime.sendMessage(
                {
                    type:
                        "VAULTX_GET_LATEST_OTP"
                },
                async (response) => {
                    otpCheckInProgress =
                        false;

                    otpButton.disabled =
                        false;

                    otpButton.style.cursor =
                        "pointer";

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
                        otpButton.textContent =
                            "❌ " +
                            (
                                response?.error ||
                                "OTP fetch failed"
                            );

                        resetOtpButtonText(
                            otpButton,
                            3000
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
                            2500
                        );

                        return;
                    }

                    /*
                     * Wait because some websites render
                     * OTP inputs after opening the modal.
                     */
                    const otpFields =
                        await waitForOtpFields(
                            15,
                            250
                        );

                    if (
                        otpFields.length === 0
                    ) {
                        otpButton.textContent =
                            "❌ OTP fields not found";

                        resetOtpButtonText(
                            otpButton,
                            3000
                        );

                        return;
                    }

                    /*
                     * Background.js also sends the OTP
                     * through VAULTX_FILL_OTP.
                     *
                     * This direct fill is kept as a fallback.
                     */
                    const filled =
                        fillOtp(
                            response.otp
                        );

                    if (
                        !filled
                    ) {
                        otpButton.textContent =
                            "❌ OTP filling failed";

                        resetOtpButtonText(
                            otpButton,
                            3000
                        );

                        return;
                    }

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
   RESET OTP BUTTON
   ========================================================= */

function resetOtpButtonText(
    button,
    delay
) {
    setTimeout(
        () => {
            if (
                !button
            ) {
                return;
            }

            button.disabled =
                false;

            button.style.cursor =
                "pointer";

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

function showVaultXMatches(
    credentials
) {
    const loginFields =
        detectLoginFields();

    const isLoginPage =
        loginFields.usernameFields > 0 &&
        loginFields.passwordFields > 0;

    if (
        !isLoginPage ||
        !Array.isArray(credentials) ||
        credentials.length === 0
    ) {
        if (isLoginPage) {
            showOtpButtonIfNeeded();
        } else {
            removeVaultXUI();
        }

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
        `${credentials.length} account${
            credentials.length > 1
                ? "s"
                : ""
        }`;

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

    currentCredentials =
        credentials;

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
                    borderLeft: "3px solid transparent",
                    borderRadius: "6px",
                    background: "#242424",
                    color: "#ffffff",
                    padding: "10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.2s"
                }
            );

            const accountRow =
                document.createElement("div");

            Object.assign(
                accountRow.style,
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
                    fontSize: "10px",
                    color: "#ffffff"
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
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis"
                }
            );

            const maskedPassword =
                document.createElement("div");

            maskedPassword.textContent =
                "••••••••••••••";

            Object.assign(
                maskedPassword.style,
                {
                    fontSize: "11px",
                    color: "#d4d4d4",
                    letterSpacing: "1px",
                    marginTop: "2px"
                }
            );

            textContainer.appendChild(
                username
            );

            textContainer.appendChild(
                maskedPassword
            );

            accountRow.appendChild(
                icon
            );

            accountRow.appendChild(
                textContainer
            );

            accountButton.appendChild(
                accountRow
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

    /*
     * Important:
     * Add Gmail OTP only when OTP fields
     * are present on the current webpage.
     */
    if (
        detectOtpFields().length > 0
    ) {
        appendOtpButton(
            container
        );
    }

    document.body.appendChild(
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
                "0.65";

            item.style.cursor =
                "wait";
        }
    );

    button.textContent =
        "Verifying PIN...";

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

            if (
                chrome.runtime.lastError
            ) {
                console.error(
                    "VaultX autofill error:",
                    chrome.runtime.lastError.message
                );

                button.textContent =
                    credential.username ||
                    "Saved account";

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
                    credential.username ||
                    "Saved account";

                return;
            }

            button.textContent =
                "✓ Filled";

            setTimeout(
                () => {
                    if (
                        button
                    ) {
                        button.textContent =
                            credential.username ||
                            "Saved account";
                    }
                },
                1800
            );
        }
    );
}


/* =========================================================
   FILL CREDENTIAL INTO WEBSITE
   ========================================================= */

function fillCredential(
    username,
    password
) {
    const loginFields =
        detectLoginFields();

    const inputs =
        Array.from(
            document.querySelectorAll("input")
        );

    const usernameInput =
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

            return (
                type === "email" ||
                autocomplete === "username" ||
                name.includes("user") ||
                name.includes("email") ||
                id.includes("user") ||
                id.includes("email") ||
                id.includes("login") ||
                placeholder.includes("email") ||
                placeholder.includes("username")
            );
        });

    const passwordInput =
        inputs.find(
            (input) =>
                (input.type || "").toLowerCase() ===
                "password"
        );

    let filled =
        false;

    if (
        usernameInput &&
        typeof username === "string"
    ) {
        setNativeInputValue(
            usernameInput,
            username
        );

        filled =
            true;
    }

    if (
        passwordInput &&
        typeof password === "string"
    ) {
        setNativeInputValue(
            passwordInput,
            password
        );

        filled =
            true;
    }

    console.log(
        "VaultX credential fill result:",
        {
            usernameFound: Boolean(usernameInput),
            passwordFound: Boolean(passwordInput),
            loginFields
        }
    );

    return filled;
}


/* =========================================================
   NATIVE INPUT VALUE SETTER
   ========================================================= */

function setNativeInputValue(
    input,
    value
) {
    const prototype =
        Object.getPrototypeOf(input);

    const valueSetter =
        Object.getOwnPropertyDescriptor(
            prototype,
            "value"
        )?.set;

    if (
        valueSetter
    ) {
        valueSetter.call(
            input,
            value
        );
    } else {
        input.value =
            value;
    }

    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    input.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );

    input.dispatchEvent(
        new Event(
            "blur",
            {
                bubbles: true
            }
        )
    );
}


/* =========================================================
   FILL OTP
   ========================================================= */

function fillOtp(
    otp
) {
    if (
        otp === null ||
        otp === undefined
    ) {
        return false;
    }

    const cleanOtp =
        String(otp).replace(
            /\D/g,
            ""
        );

    if (
        cleanOtp.length === 0
    ) {
        return false;
    }

    const otpFields =
        detectOtpFields();

    if (
        otpFields.length === 0
    ) {
        console.warn(
            "VaultX: OTP fields not found."
        );

        return false;
    }

    /*
     * Case 1:
     * One OTP input box accepting complete OTP.
     */
    if (
        otpFields.length === 1
    ) {
        const input =
            otpFields[0];

        const maxLength =
            Number(input.maxLength);

        if (
            maxLength !== 1
        ) {
            setNativeInputValue(
                input,
                cleanOtp
            );

            return true;
        }
    }

    /*
     * Case 2:
     * Multiple separate OTP boxes.
     */
    const digits =
        cleanOtp.split("");

    let filledCount =
        0;

    otpFields.forEach(
        (input, index) => {
            if (
                index >= digits.length
            ) {
                return;
            }

            setNativeInputValue(
                input,
                digits[index]
            );

            filledCount++;
        }
    );

    /*
     * Some websites automatically move focus
     * to the next input after each digit.
     */
    if (
        filledCount > 0
    ) {
        const lastField =
            otpFields[
                Math.min(
                    filledCount - 1,
                    otpFields.length - 1
                )
            ];

        if (
            lastField
        ) {
            lastField.dispatchEvent(
                new Event(
                    "change",
                    {
                        bubbles: true
                    }
                )
            );
        }
    }

    console.log(
        "VaultX OTP filled:",
        {
            totalFields:
                otpFields.length,

            filledCount
        }
    );

    return filledCount > 0;
}


/* =========================================================
   REQUEST CREDENTIAL CHECK
   ========================================================= */

function requestCredentialCheck() {
    if (
        checkInProgress
    ) {
        return;
    }

    if (
        !document.body
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

                return;
            }

            console.log(
                "VaultX page check:",
                response
            );

            const credentials =
                Array.isArray(
                    response?.credentials
                )
                    ? response.credentials
                    : [];

            const otpFields =
                detectOtpFields();

            /*
             * Saved credentials found.
             * OTP section will be added only if
             * OTP fields are also present.
             */
            if (
                credentials.length > 0
            ) {
                showVaultXMatches(
                    credentials
                );

                return;
            }

            /*
             * No credentials, but OTP fields exist.
             */
            if (
                otpFields.length > 0
            ) {
                showOtpButtonIfNeeded();

                return;
            }

            /*
             * No login credentials and no OTP.
             */
            removeVaultXUI();
        }
    );
}


/* =========================================================
   WATCH DYNAMIC PAGE CHANGES
   ========================================================= */

function watchDynamicLoginForms() {
    if (
        !document.documentElement
    ) {
        return;
    }

    const observer =
        new MutationObserver(
            (mutations) => {
                const pageMutated =
                    mutations.some(
                        (mutation) => {
                            return !isVaultXElement(
                                mutation.target
                            );
                        }
                    );

                if (!pageMutated) {
                    return;
                }

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

                            /*
                             * Recheck when:
                             * - Login fields appear
                             * - OTP fields appear
                             * - OTP modal opens
                             */
                            if (
                                (
                                    loginFields.usernameFields > 0 &&
                                    loginFields.passwordFields > 0
                                ) ||
                                otpFields.length > 0 ||
                                getOtpModalContainers().length > 0
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
   WATCH LOGOUT ACTIONS
   ========================================================= */

function watchLogoutActions() {
    document.addEventListener(
        "click",
        (event) => {
            const target =
                event.target instanceof Element
                    ? event.target.closest(
                        "button, a, [role='button']"
                    )
                    : null;

            if (!target || isVaultXElement(target)) {
                return;
            }

            const actionText = (
                target.textContent ||
                target.getAttribute("aria-label") ||
                target.getAttribute("title") ||
                target.getAttribute("href") ||
                ""
            ).toLowerCase();

            if (
                !/(log\s*out|sign\s*out|logout|signout)/i.test(
                    actionText
                )
            ) {
                return;
            }

            clearTimeout(
                window.__vaultxLogoutCheckTimer
            );

            window.__vaultxLogoutCheckTimer =
                setTimeout(
                    () => {
                        removeVaultXUI();
                        requestCredentialCheck();
                    },
                    800
                );
        },
        true
    );
}


/* =========================================================
   WATCH SPA NAVIGATION
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

    setInterval(
        () => {
            if (
                window.location.href !==
                lastCheckedUrl
            ) {
                handleUrlChange();
            }
        },
        1000
    );
}


/* =========================================================
   HANDLE URL CHANGE
   ========================================================= */

function handleUrlChange() {
    const newUrl =
        window.location.href;

    if (
        newUrl ===
        lastCheckedUrl
    ) {
        return;
    }

    lastCheckedUrl =
        newUrl;

    currentCredentials =
        [];

    removeVaultXUI();

    console.log(
        "VaultX detected navigation:",
        newUrl
    );

    setTimeout(
        () => {
            requestCredentialCheck();
        },
        700
    );
}


/* =========================================================
   INITIALIZE VAULTX
   ========================================================= */

function initializeVaultX() {
    console.log(
        "VaultX content.js initialized.",
        getPageInfo()
    );

    requestCredentialCheck();

    watchDynamicLoginForms();

    watchLogoutActions();

    watchSpaNavigation();
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
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