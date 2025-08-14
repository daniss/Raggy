<!-- CLAUDE.md — compact guide for the AI agent -->

# Project Snapshot (compact)

Prime directive: Modify existing files first; creating new files is the last option. After any change, always run:

```
pnpm run type-check && pnpm build
```

If it fails, fix it before proceeding.

## Architecture in one glance
- App: Next.js 15 (App Router) in `rag-saas-ui/`
- Backend: Next.js Route Handlers + Supabase (auth, DB, storage). No separate Node/Express.
- RAG: Only FastAPI is used for Retrieval-Augmented Generation. Nothing else runs on FastAPI.
- UI: Tailwind + shadcn/radix. State via lightweight React contexts.

Constraints for the agent:
- Do not create parallel modules; extend the closest existing route, component, or context.
- Centralize server logic in Next Route Handlers and Supabase utilities, not new backend services.
- For RAG, only touch the dedicated FastAPI endpoints; do not add non-RAG features to FastAPI.
- Before commit: run `pnpm run type-check && pnpm build` and fix errors.

## Where things live
```
rag-saas-ui/
    app/                # pages + route handlers (server)
    components/         # UI building blocks
    contexts/           # app/org/permissions (keep minimal)
    lib/                # feature flags, helpers (extend here)
```

## Feature flags & navigation
- Extend `lib/features.ts` for new flags; do not create another features file.
- Update existing nav components rather than adding new variants.

## Data and APIs
- Use Supabase client utils for auth, DB, storage. Prefer server components/route handlers.
- Do not add fetch layers in many places—add a single `lib/api.ts` if truly needed and reuse it.
- Mock data should extend existing mocks in-place until real endpoints exist.

## Quick checklist before commit
- [ ] Edited existing files (any new file is justified)
- [ ] pnpm run type-check passes
- [ ] pnpm build succeeds
- [ ] No duplicate modules or parallel APIs were introduced
- [ ] Nav/feature gating updated consistently when adding features

That’s all—keep it compact, consistent, and type-safe.