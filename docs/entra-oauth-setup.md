# Microsoft Entra ID Setup

This guide walks through creating Microsoft Entra credentials for the CV Tool application.

## Prerequisites

- Access to your organization's Microsoft Entra admin center

## 1. Create an app registration

1. Go to Microsoft Entra admin center
2. Open **App registrations**
3. Click **New registration**
4. Name the app `CV Tool`
5. Choose **Accounts in this organizational directory only**
6. Save the registration

Record these values from the overview page:

- `Application (client) ID`
- `Directory (tenant) ID`

## 2. Configure SPA authentication

1. Open the app registration
2. Go to **Authentication**
3. Add platform: **Single-page application**
4. Add redirect URIs:
   - `http://localhost:5173`
   - add your deployed frontend origin as needed

Do not create a client secret for the frontend SPA.

## 3. Configure local environment variables

Backend `.env`:

```env
ENTRA_CLIENT_ID=your_application_client_id
ENTRA_TENANT_ID=your_directory_tenant_id
```

Frontend environment:

```env
VITE_ENTRA_CLIENT_ID=your_application_client_id
VITE_ENTRA_TENANT_ID=your_directory_tenant_id
```

## 4. Verify the setup

1. Start the app locally
2. Open `http://localhost:5173/login`
3. Click **Sign in with Microsoft**
4. Complete the Entra login flow
5. Verify you are redirected to `/employees`
