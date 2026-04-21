# HangOwl Frontend

Next.js 15 PWA frontend for HangOwl.

## Setup

```bash
cd frontend
npm install
```

## Configuration

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Run

```bash
npm run dev
```

Opens at `http://localhost:3000`.

## Pages

| Route           | Auth     | Description              |
|-----------------|----------|--------------------------|
| /               | Public   | Landing + feed           |
| /feed/[id]      | Public   | Post detail + replies    |
| /hangouts       | Required | Plans board + creation   |
| /plan/[id]      | Public   | Shareable plan detail    |
| /profile        | Required | Your profile + my posts  |
| /notifications  | Required | In-app notifications     |
| /ranks          | Public   | Hangout leaderboard      |
| /verify         | Public   | Email OTP verification   |

## PWA

The app is a Progressive Web App with:
- Offline support via service worker
- Add to home screen prompt
- Push notification support
- Standalone display mode
