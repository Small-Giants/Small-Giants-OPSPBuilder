# Small Giants OPSP Builder

This project is a Next.js application integrated with Firebase for Authentication and Firestore for the database.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend/Database:** Firebase Firestore
- **Authentication:** Firebase Authentication
- **Hosting:** Firebase Hosting

## Getting Started

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

3.  Open [http://localhost:3000](http://localhost:3000) with your browser.

## Firebase Configuration

The Firebase configuration is located in `src/lib/firebase.ts`.
Ensure you have set up your Firebase project and enabled:
- Authentication (Email/Password)
- Firestore Database

## Deployment

To deploy to Firebase Hosting:

```bash
npm run build
firebase deploy
```
