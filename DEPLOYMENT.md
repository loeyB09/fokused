# Deployment Guide

## 1. Push the project to GitHub

From the repository root:

```bash
git init
git add .
git commit -m "Prepare app for deployment"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2. Create a Railway project

1. Go to Railway.
2. Create a new project from your GitHub repo.
3. Select this repository.

## 3. Add a PostgreSQL database

1. In Railway, add a new `PostgreSQL` service to the same project.
2. Railway will generate a `DATABASE_URL` for you.

## 4. Configure environment variables

In the Railway app service, add these variables:

```env
SECRET_KEY=<LONG_RANDOM_SECRET>
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
OPENAI_MODEL=gpt-4.1-mini
DATABASE_URL=<RAILWAY_POSTGRES_DATABASE_URL>
FLASK_ENV=production
```

## 5. Deploy the web service

Railway will use:

- `railway.json`
- `Procfile`

The app starts with:

```bash
cd app && gunicorn app:app --bind 0.0.0.0:$PORT
```

## 6. Initialize the database

After the first deploy, run this inside Railway:

```bash
cd app && flask --app app.py init-db
```

This creates the production tables.

## 7. Test the deployed app

Test these flows:

1. Sign up a new user
2. Sign in with a second user
3. Verify each user only sees their own tasks
4. Create tasks and subtasks
5. Test calendar and timer pages
6. Test AI task breakdown

## 8. Performance testing

Use a load-testing tool like `k6` or `Locust` against the deployed URL.

Focus first on:

1. `POST /signup`
2. `POST /signin`
3. `GET /api/tasks`
4. `POST /api/tasks`
5. `GET /api/calendar`

Do not heavily load-test the OpenAI endpoints unless you want to spend API credits.

## 9. Important note

Your old local SQLite database is not used in production anymore.
The deployed app uses PostgreSQL and tasks are now linked to users with `user_id`.
