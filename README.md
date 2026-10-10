# Onboarding Buddy

A-to-Z onboarding for any company: HR meets job training. Every new hire gets a journey of stages; each
stage opens with a short video, holds tasks with one owner each (the hire, People Ops, IT, their manager or
their buddy), and includes walkthroughs of the company's connected apps.

## Run it

```bash
npm install
npm run seed      # demo company "Brightside"
npm run dev       # http://localhost:5174
```

Sign in as any demo person from the login screen (password `buddy-demo-2026`).

## Stack

Node (zero dependencies, built-in `node:sqlite`) · Vite + React + TypeScript · plain CSS tokens.
See `SPEC.md` for the data model, API and screens.

## Tests

```bash
npm test
```
