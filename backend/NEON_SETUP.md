# Using Neon Cloud Database

This project uses a **Neon** PostgreSQL database in the cloud so the whole team shares the same data.

---

## For your team: connect to Neon from A to Z

Follow these steps once on your machine to use the shared Neon database.

### Step 1. Get the connection string

- Ask your project lead (or whoever created the Neon project) for the **Neon connection string**.
- It looks like:  
  `postgresql://neondb_owner:xxxxx@ep-xxx-pooler.xxx.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Do not** commit or paste this string in chat or in code - treat it like a password. Use a secure channel (e.g. team password manager, secure chat).

If you have access to [Neon Console](https://console.neon.tech):

1. Open the project (e.g. "Ligtas Team DB").
2. Click **Connect**.
3. Leave **Connection pooling** ON.
4. Copy the **connection string**.

### Step 2. Clone the repo and open the backend

```bash
git clone <your-repo-url>
cd ligtas-team-project/backend
```

### Step 3. Install dependencies

```bash
npm install
```

### Step 4. Create your local `.env`

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open `backend/.env` in your editor.
3. Set `DATABASE_URL` to the **Neon connection string** you received (paste the full string, in quotes).
4. Save the file.  
   **Do not commit `.env`** - it should stay in `.gitignore`.

### Step 5. Generate Prisma client and sync the database

Generate the Prisma client:

```bash
npx prisma generate
```

If the project uses **Prisma Migrate** (there is a `prisma/migrations` folder), apply migrations:

```bash
npx prisma migrate deploy
```

If there is **no** `prisma/migrations` folder, push the schema instead:

```bash
npx prisma db push
```

(You only need to run `migrate deploy` or `db push` when the schema has changed or when you set up for the first time.)

### Step 6. Run the backend

```bash
npm run dev
```

The API will use the Neon cloud database. You're done.

---

## For the project owner: first-time Neon setup

If you're the one who created the Neon project and want to point the app to it:

1. In [Neon Console](https://console.neon.tech), open your project -> **Connect** -> copy the connection string (with connection pooling ON).
2. In `backend`, create `.env` from `.env.example` and set `DATABASE_URL` to that string.
3. Run `npx prisma generate` then either `npx prisma migrate deploy` or `npx prisma db push` (see Step 5 above).
4. Share the connection string with your team **securely** (e.g. password manager). They then follow the "For your team" section above.

---

## (Optional) Copy existing data from local to Neon

Only if you need to **move data** from an old local PostgreSQL database into Neon:

1. Export from local (adjust user/password/db name if different):
   ```bash
   pg_dump -h localhost -U postgres -d ligtas --no-owner --no-acl -F c -f ligtas_backup.dump
   ```
2. Restore into Neon (use the **non-pooler** connection string from Neon for `pg_restore`):
   ```bash
   pg_restore -h YOUR_NEON_HOST -U neondb_owner -d neondb --no-owner --no-acl -F c ligtas_backup.dump
   ```
   You'll be prompted for the Neon database password.

If you don't need old data, skip this and use the app with the empty (or already populated) Neon database.
