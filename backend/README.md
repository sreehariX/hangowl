# HangOwl Backend

FastAPI backend for HangOwl - the hyperlocal campus social PWA.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Copy `.env` and fill in your values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
RESEND_API_KEY=re_xxxxx
SECRET_SALT=a-long-random-string
JWT_SECRET=another-long-random-string
```

## Run

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

## API Routes

| Method | Route              | Auth     | Description                    |
|--------|--------------------|----------|--------------------------------|
| POST   | /auth/send-otp     | Public   | Send OTP to @iitb.ac.in email |
| POST   | /auth/verify-otp   | Public   | Verify OTP, get JWT + persona  |
| GET    | /plans             | Public   | List active plans              |
| POST   | /plans             | Required | Create a plan                  |
| GET    | /plans/{id}        | Public   | Get single plan                |
| POST   | /plans/{id}/join   | Required | Join a plan                    |
| GET    | /leaderboard       | Public   | Hostel leaderboard             |
| GET    | /stats             | Public   | Live stats (free count)        |

## Database

Run `schema.sql` in your Supabase SQL editor to create all tables.
