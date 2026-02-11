# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Run with Docker (frontend + script server + database)

If Lovable isn't available, you can run everything locally with Docker Compose.

```sh
docker compose up --build
```

This will start:
- `app` (Vite frontend) on http://localhost:5173
- `script-server` (script runner) on http://localhost:5050
- `api` (Python backend) on http://localhost:8000
- `db` (PostgreSQL) on localhost:5432
- `pgadmin` (PostgreSQL GUI) on http://localhost:5051
- `adminer` (fallback DB GUI) on http://localhost:5052

### pgAdmin login and DB connection

Use these default credentials to sign in to pgAdmin:
- Email: `admin@snug.local`
- Password: `admin`

Then add a new server in pgAdmin with:
- Host: `db`
- Port: `5432`
- Username: `snug`
- Password: `snug_password`
- Database: `snug_ledger`

### If http://localhost:5051 says "connection refused"

Run these commands in order:

```sh
docker compose up -d db pgadmin adminer
docker compose ps
docker compose logs --tail=100 pgadmin
```

What to check:
- If `pgadmin` is **Up**, open http://localhost:5051 again.
- If `pgadmin` is not up, use fallback GUI **Adminer** at http://localhost:5052.

Adminer login values:
- System: `PostgreSQL`
- Server: `db`
- Username: `snug`
- Password: `snug_password`
- Database: `snug_ledger`

To stop everything:

```sh
docker compose down
```

## Local test script (keep this updated)

Run the local test script after changes to verify the frontend, Python API, and script runner:

```sh
bash scripts/test-local.sh
```

**Important:** Update `scripts/test-local.sh` whenever you change APIs, ports, or behavior so it always works with the latest code.


### Data storage approach (recommended)

To support accounts, SIE files, and receipts tied to a user, a common pattern is:
- Store **metadata** in the database (user ID, file type, bookkeeping period, filename, size, checksum, timestamps).
- Store the **binary files** in object storage (S3/MinIO) or a dedicated file volume.
- Save the storage path/URL in the DB.

This keeps the database fast and lets you manage large files safely. You can also use a local Docker volume during development.

## Python backend (FastAPI) quick start

The Docker setup includes a simple Python API so you can work in Python only.

Example endpoints:
- `GET http://localhost:8000/health`
- `GET http://localhost:8000/users`
- `POST http://localhost:8000/users` with JSON `{ "email": "test@example.com", "password": "secret", "name": "Test" }`
- `POST http://localhost:8000/auth/login` with JSON `{ "email": "test@example.com", "password": "secret" }`

The API seeds these users at startup:
- Test user: `test@test.com` / `test`
- Admin user: `admin@snug.local` / `admin`

The API runs Alembic migrations automatically on startup.

Admin UI:
- Visit `http://localhost:5173/admin` after logging in as the admin user.

### Admin and password reset tokens

Set these environment variables (see `docker-compose.yml`) to secure admin actions:
- `ADMIN_TOKEN` (required for role changes)
- `PASSWORD_RESET_TOKEN` (required for password reset)

Do not expose tokens in frontend environment variables. Enter them manually in the Admin Panel or reset form.

## Production migrations

Run migrations in production with:

```sh
alembic -c backend/alembic.ini upgrade head
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
