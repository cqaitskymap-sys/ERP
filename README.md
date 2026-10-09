# PATRI — Pharmaceutical Manufacturing ERP

Production-grade ERP foundation for a third-party pharmaceutical manufacturing company.

This phase delivers the platform shell only: authentication, permissions, audit, Firebase, reusable UI, and the operations workspace. Business modules are reserved as routes and will be implemented later.

## Stack

- Next.js 16 App Router + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Firebase Authentication, Firestore, Storage
- Recharts

## How to run

```bash
npm install
copy .env.example .env.local
```

Fill Firebase values in `.env.local`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint
npm run build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | No | Product name shown in the shell |
| `NEXT_PUBLIC_APP_SHORT_NAME` | No | Short mark in the sidebar |
| `NEXT_PUBLIC_COMPANY_NAME` | No | Company label |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL |
| `NEXT_PUBLIC_REQUIRE_AUTH` | No | Set `true` to force login for the workspace |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Messaging sender id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app id |

## Firebase setup

1. Enable **Email/Password** in Firebase Authentication.
2. Create a Firestore database.
3. Enable Firebase Storage.
4. Deploy rules when ready:

```bash
npx -y firebase-tools@latest use erp-system-b62d7
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

## Architecture

```
src/
  app/                 Routes, layouts, error/loading states, API
  components/ui        Primitive design system
  components/forms     Reusable form building blocks
  components/tables    Reusable data table
  components/layout    Sidebar, top nav, breadcrumbs, shell
  components/feedback  Empty, loading, modal, status
  lib/firebase         App / Auth / Firestore / Storage init
  lib/auth             Session, sign-in, profile bootstrap
  lib/permissions      RBAC catalog and checks
  lib/audit            Immutable activity writer
  lib/services         Generic Firestore and Storage helpers
  lib/validation       Zod schemas
  hooks/               Auth, permissions, confirm, media
  types/               Shared contracts
```

Future modules should:

- add a nav item in `src/lib/config/navigation.ts`
- reuse `PageHeader`, `DataTable`, `FormSection`, `AppModal`, and `useConfirm`
- write business documents through `lib/services`
- record operator actions through `writeAuditEvent`
- gate screens with `usePermission("module:action")`
