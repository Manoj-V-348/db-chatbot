# Campus Finance POC

Campus Finance POC is a Vite + React + TypeScript frontend that visualizes read-only Firestore data for College 1, School 1, and School 2. It ships with a conversational chat surface, a tabular explorer, and an Apple-inspired glassmorphism UI.

## Quickstart

1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch the dev server:
   ```bash
   npm run dev
   ```

## Firebase configuration

Update `src/firebase.ts` with your Firebase project credentials. The file contains `TODO` placeholders for each required field—copy the values from the Firebase console.

> **Important:** This proof of concept assumes permissive, public Firestore rules for simplicity. Lock rules down before promoting this code to production.

## What’s inside

- **React + Vite + TypeScript** with TailwindCSS for styling.
- **Chat tab** that parses natural language into metrics, fetches Firestore data client-side, and formats responses in INR.
- **Data tab** with collection toggles, status filtering, search, sorting, and CSV export of the active view.

Enjoy exploring campus finances with a little Apple-grade polish.

