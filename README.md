# VaultX — Secure Password Manager & College Portal Assistant

VaultX is a Chrome extension designed to help users securely organize their login credentials, manage multiple vaults, monitor credential security, and simplify college portal access with automatic OTP assistance.

With a clean dashboard and dedicated sections for vaults, credentials, security, and settings, VaultX brings essential credential management features together in one place.

# Features

- User Authentication:** Register an account and log in securely.
- Dashboard:** View vault statistics, saved credentials, and your security score.
- Multiple Vaults:** Create and manage multiple vaults to organize credentials by category, such as College, Personal, or Work.
- Credential Management:** Add, view, search, edit, copy, reveal, and delete saved credentials.
- Password View Security:** Protect saved password viewing and editing with a six-digit PIN.
- Security Dashboard:** Review available security checks and your credential security status.
- College Assistant:** Connect your college Google account to help retrieve OTP emails for the Cybervidya college portal.
- OTP Assistance:** Support the automatic OTP workflow for the college portal after the required Google account connection and permissions are configured.
- Autofill Preferences:** Enable or disable VaultX's login-page detection and credential autofill preferences.
- Account Settings:** Update your account password, manage your Google account connection, and configure available security settings.
- Two-Factor Authentication:** Enable 2FA for an additional layer of account protection.

# Technology Stack

VaultX uses the following technologies:

- Frontend:** React, TypeScript, Vite
- Browser Platform:** Chrome Extension Manifest V3
- Backend:** Python, FastAPI
- Database:** PostgreSQL
- Authentication and Security:** JWT-based authentication, password hashing, credential encryption, and PIN protection
- API Communication:** Axios
- Deployment:** Render for the backend
- College Assistant Integration:** Google account integration for OTP assistance

# Installation

You can install VaultX manually using the ZIP file available in the project's GitHub Releases.

# Step 1: Download VaultX

1. Open the [VaultX Releases page](https://github.com/rishabhraj2511/Password-Manager/releases).
2. Download the latest `VaultX-v1.0.0.zip` release asset.
3. Extract the ZIP file to a folder on your computer.

# Step 2: Install the extension in Chrome

1. Open Google Chrome.
2. Enter the following address in the address bar:

   ```text
   chrome://extensions
   ```

3. Enable Developer mode using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the extracted VaultX folder that contains `manifest.json`.
6. VaultX should now appear in your Chrome extensions list.
7. Open Chrome's Extensions menu and pin VaultX for convenient access.

**Note:** Manual installation requires Developer mode. VaultX is not installed through the Chrome Web Store using this method.

# How to Use VaultX

# 1. Register an Account

1. Open the VaultX extension.
2. Enter your email address.
3. Create a password.
4. Click **Register**.
5. After successful registration, proceed to login.
   <img width="319" height="458" alt="image" src="https://github.com/user-attachments/assets/781d9a2b-77c3-4675-ba99-daac7d842f61" />


# 2. Log In

1. Enter your registered email address.
2. Enter your account password.
3. Click **Login**.

After successful authentication, the VaultX dashboard opens.
<img width="319" height="354" alt="image" src="https://github.com/user-attachments/assets/96950845-14dd-4d51-b4b3-da9348cd738f" />
<img width="336" height="542" alt="image" src="https://github.com/user-attachments/assets/0b69e6fd-3b2c-4b50-8a09-204fd1fb3cdd" />


# 3. Create Your First Vault

Vaults help you organize credentials into separate groups.

1. Open the **Vaults** section.
2. Click **Create Vault**.
3. Enter a vault name, such as `College`, `Personal`, or `Work`.
4. Save the vault.

You must create at least one vault before organizing credentials. You can create multiple vaults and manage them independently.
<img width="317" height="495" alt="image" src="https://github.com/user-attachments/assets/700377a5-900d-4e14-bb24-b9dadb0f931e" />


# 4. Add and Manage Credentials

After creating a vault:

1. Open the **Credentials** section or use the **Add Credential** quick action also you can use vault to add credentials.
2. Select the appropriate vault.
3. Enter the required credential details, such as the website, account username, and password.
4. Save the credential.
   <img width="292" height="543" alt="image" src="https://github.com/user-attachments/assets/98edc817-324f-4d2e-a283-98590bf5f1d6" />


From the Credentials section, you can:

- Search for saved credentials.
- Filter credentials by vault.
- Copy saved information.
- Reveal a saved password after PIN verification.
- Edit existing credentials and update their details.
- Delete credentials you no longer need.

# 5. Use the Security Section

Open **Security** to review the available security checks and your credential security status.

Depending on the checks provided by your current version, this section can help you identify potential password-security concerns and understand your overall security score.

Review the available recommendations and take appropriate action to improve your credential security.
<img width="329" height="601" alt="image" src="https://github.com/user-attachments/assets/e9af65fa-903b-48af-9c0e-64fb412edf87" />


# 6. Configure the College Assistant

VaultX includes a College Assistant designed to help with OTP access for the Cybervidya college portal.

To configure it:

1. Open **Settings**.
2. Expand the **College Assistant** section.
3. Connect your college Google account.
4. Complete the required Google authentication and authorization steps.
5. Confirm that your account is connected.

Once configured, VaultX can use the supported email integration to retrieve OTP emails and assist with the college portal's OTP workflow.

**Important:** OTP assistance depends on the Google account connection, granted permissions, and compatibility with the college portal. Never share your Google password or OTP with anyone.
<img width="314" height="367" alt="image" src="https://github.com/user-attachments/assets/7cf41d6d-9bb7-4428-b3d1-32bf5304813f" />


# 7. Configure Password View Security

VaultX provides a six-digit PIN to protect access to saved passwords.

1. Open **Settings**.
2. Find **Password View Security**.
3. Set up your six-digit PIN if it is not already enabled.
4. Follow the prompts to change your PIN when required.

When you attempt to reveal or edit a saved password, VaultX can require PIN verification before allowing access.

Keep your PIN private and avoid using an easily guessed combination.
<img width="294" height="322" alt="image" src="https://github.com/user-attachments/assets/9b603490-f841-42c5-93db-0929f7e0feeb" />


# 8. Manage Autofill Preferences

In **Settings**, find **Autofill Preferences**.

Use the available toggle to enable or disable VaultX's login-page detection and credential autofill behavior.
<img width="321" height="354" alt="image" src="https://github.com/user-attachments/assets/1b3a9e69-935f-417f-ae3f-4c1c956eac6e" />


# 9. Update Your Account Password

1. Open **Settings**.
2. Find **Change Account Password**.
3. Enter your current password.
4. Enter your new password.
5. Confirm the new password.
6. Click **Update Password**.

Use a strong, unique password for your VaultX account.
<img width="335" height="451" alt="image" src="https://github.com/user-attachments/assets/ef1aa802-d985-456c-b472-29c2ab8fa818" />


# 10. Enable Two-Factor Authentication

For additional account protection:

1. Open **Settings**.
2. Find **Two-Factor Authentication**.
3. Click **Enable 2FA**.
4. Follow the instructions displayed by VaultX to complete the setup.
   <img width="330" height="576" alt="image" src="https://github.com/user-attachments/assets/9f48620c-24bf-4e5a-a544-23851f9fa29d" />


If you no longer need an active session, click **Log out**.

# Project Structure

The project is organized into two primary parts:

```text
VaultX/
├── Backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── Models/
│   │   ├── schemas/
│   │   ├── security.py
│   │   └── main.py
│   └── requirements.txt
│
├── Extention/
│   ├── public/
│   ├── src/
│   │   ├── Components/
│   │   ├── Context/
│   │   ├── Pages/
│   │   └── Services/
│   ├── package.json
│   ├── index.html
│   └── vite.config.ts
│
└── README.md
```

*Note: The folder names and individual files may evolve as the project develops.*

# Development Setup

If you want to run or modify VaultX locally, follow these steps.

# Prerequisites

- Node.js and npm
- Python
- PostgreSQL, or access to a configured PostgreSQL database
- Google Chrome
- Git

# Frontend Setup

Open a terminal and navigate to the extension directory:

```powershell
cd Extention
npm install
npm run dev
```

To create the production extension build:

```powershell
npm run build
```

Vite generates the production build in the `Extention/dist` directory.

To test the built extension, open `chrome://extensions`, enable Developer mode, and load the folder containing the built `manifest.json`.

# Backend Setup

Open a separate terminal:

```powershell
cd Backend
python -m venv venv
```

Activate the virtual environment on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the dependencies:

```powershell
pip install -r requirements.txt
```

Configure the required environment variables in a local `.env` file. These include the database connection, application secrets, encryption key, and any required email or Google integration settings.

Do not commit `.env` files or secrets to GitHub.

Run database migrations according to the project's Alembic configuration, then start the backend:

```powershell
uvicorn app.main:app --reload
```

The local API will generally be available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

The extension must be configured to use the correct API URL for the environment you are testing.

# Security and Privacy

VaultX handles sensitive account and credential information. Follow these precautions:

- Use a strong, unique VaultX account password.
- Keep your six-digit password-view PIN private.
- Never share passwords, OTPs, API tokens, encryption keys, or database credentials.
- Keep environment variables and `.env` files out of public repositories.
- Only connect Google accounts you are authorized to use.
- Review the permissions requested during Google account connection.
- Use the official project release and verify that you trust the source before installing the extension.
- Keep the extension and its dependencies updated.

Security features should be tested and reviewed before VaultX is used to store important real-world credentials.

# Future Improvements

Potential future enhancements include:

- Chrome Web Store publication
- Improved onboarding and setup guidance
- Expanded password-strength and security checks
- More comprehensive testing and error handling
- Improved backup and recovery options
- Additional autofill compatibility

# Contributing

Contributions, bug reports, and suggestions are welcome.

If you find a problem, open an issue in the [VaultX GitHub repository](https://github.com/rishabhraj2511/Password-Manager) with a clear description of the issue and the steps needed to reproduce it.

Never include real passwords, OTPs, access tokens, or other sensitive information in issues or screenshots.

*VaultX — Your credentials, organized in one place. *
