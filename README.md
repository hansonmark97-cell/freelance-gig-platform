# freelance-gig-platform
A modern freelance gig work platform

## Running in Termux (Android)

[Termux](https://termux.dev/) is an Android terminal emulator that lets you run this project directly on your Android device.

### 1. Install Termux

Download and install Termux from [F-Droid](https://f-droid.org/packages/com.termux/) (recommended) or the [Termux GitHub releases](https://github.com/termux/termux-app/releases).

### 2. Install required packages

Open Termux and run:

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs
```

### 3. Clone the repository

```bash
git clone https://github.com/hansonmark97-cell/freelance-gig-platform.git
cd freelance-gig-platform
```

### 4. Install dependencies

```bash
npm install
```

### 5. Configure environment variables

Create a `.env` file (or export variables directly in Termux) with the following:

```bash
export JWT_SECRET="your-jwt-secret"
export FIREBASE_PROJECT_ID="your-firebase-project-id"
export STRIPE_SECRET_KEY="your-stripe-secret-key"

# Option A – service account JSON inline:
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Option B – path to a downloaded service account key file:
export GOOGLE_APPLICATION_CREDENTIALS="/data/data/com.termux/files/home/serviceAccountKey.json"
```

> **Tip:** Add these `export` lines to `~/.bashrc` so they persist across Termux sessions.

### 6. Start the server

```bash
npm start
```

The API will be available at `http://localhost:3000`.

### 7. Run tests

```bash
npm test
```

Tests use an in-memory Firestore mock and do not require real Firebase credentials.

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register a new user |
| POST | `/api/users/login` | Log in and receive a JWT |
| GET/POST | `/api/gigs` | Browse or create gigs |
| GET/POST | `/api/jobs` | Browse or post jobs |
| GET/POST | `/api/bids` | Place or view bids |
| GET/POST | `/api/reviews` | Leave or read reviews |
| POST | `/api/payments/intent` | Create a Stripe payment intent |
