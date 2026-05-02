# Contributing

Thanks for considering a contribution to Chronoline.

## Before You Start

- Open an issue or discussion before starting large features, major refactors, or new dependencies.
- Keep the app local-first. Do not add backend services, auth, or cloud sync flows unless the change is explicitly in scope.
- Prefer focused pull requests over broad cleanup.

## Development Setup

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npx tsc --noEmit --ignoreDeprecations 6.0
npm run build
```

## Project Expectations

- Use the existing React + TypeScript + Vite stack.
- Keep persistence in IndexedDB through Dexie repositories under `src/lib/db/`.
- Use `date-fns` for date logic.
- Prefer the `@/` import alias for code under `src/`.
- Avoid hand-editing generated `src/components/ui/` files unless there is a clear reason.
- Keep changes minimal and consistent with the existing code style.

## Pull Requests

- Describe the problem and the behavior change clearly.
- Include validation notes such as lint, type-check, or build results.
- Add or update documentation when behavior or developer workflow changes.
- Call out follow-up work instead of mixing unrelated fixes into the same PR.

## Reporting Bugs

- Include reproduction steps, expected behavior, and actual behavior.
- Attach screenshots or sample timeline data when they help explain the issue.
- For security-sensitive reports, follow the guidance in `SECURITY.md` instead of opening a detailed public issue.