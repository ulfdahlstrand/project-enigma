# Google OAuth Setup

This guide walks through creating Google Cloud credentials for the CV Tool application.

## Prerequisites

- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Steps

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. Enter a project name (e.g. `cv-tool-dev`) and click **Create**
4. Wait for the project to be created, then select it

---

### 2. Enable the Google Identity API

1. In the left sidebar go to **APIs & Services → Library**
2. Search for **"Google Identity"** or **"OAuth"**
3. Click **Google Identity Toolkit API** (or **"Google Sign-In"**) → **Enable**

---

### 3. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** (for dev/test) → **Create**
3. Fill in:
   - **App name**: `CV Tool`
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue** through the remaining steps (no scopes needed beyond the defaults)
5. Add yourself as a test user under **Test users**

---

### 4. Create an OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Select **Web application**
4. Enter a name (e.g. `cv-tool-web`)
5. Under **Authorised JavaScript origins**, add:
   ```
   http://localhost:5173
   ```
   (Add your production URL here when deploying, e.g. `https://cvtool.example.com`)
6. Under **Authorised redirect URIs**, leave empty (the `@react-oauth/google` library uses the origin, not a redirect URI)
7. Click **Create**

---

### 5. Copy your credentials

After creating, Google will show a dialog with your **Client ID** and **Client Secret**. Copy the **Client ID** — you will need it in the next step.

---

### 6. Wire credentials into the project

Copy `.env.example` to `.env` at the repository root:

```bash
cp .env.example .env
```

Then set your Client ID in `.env`:

```env
# Backend: used to verify Google ID tokens server-side
GOOGLE_CLIENT_ID=your_actual_client_id_here.apps.googleusercontent.com

# Frontend (Vite): same client ID exposed to the browser
VITE_GOOGLE_CLIENT_ID=your_actual_client_id_here.apps.googleusercontent.com
```

> **Note:** Both variables use the same Client ID. The `VITE_` prefix exposes the value to the Vite/React frontend at build time.

---

## Environment variables reference

| Variable | Used by | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Backend | Verifies incoming Google ID tokens via `google-auth-library` |
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Passed to `GoogleOAuthProvider` in `App.tsx` |

---

## Verifying the setup

1. Start the dev environment:
   ```bash
   docker compose up
   npm run dev
   ```
2. Navigate to `http://localhost:5173/login`
3. Click **Sign in with Google** — the Google account picker should appear
4. After signing in, you should be redirected to `/employees`

If you see an error like `"idpiframe_initialization_failed"` or `"origin not allowed"`, double-check that `http://localhost:5173` is listed under **Authorised JavaScript origins** in your Google Cloud OAuth client.
