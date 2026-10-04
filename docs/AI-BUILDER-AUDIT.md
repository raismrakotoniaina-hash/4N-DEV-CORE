# 4N DEV AI Builder Audit

Date: 2026-10-04

## Current flow

The Builder now follows this production path:
1. Validate prompt and credit balance.
2. Generate an implementation plan.
3. Generate project files.
4. Run Builder quality review.
5. Auto-fix review failures.
6. Persist project/files in PostgreSQL when DATABASE_URL is configured.
7. Run the real Build Engine.
8. Deploy the built output to Hosting.
9. Record usage and remaining credits.

## Findings

### Fixed in this audit
- Automatic Builder deployment previously sent generated source files directly to Hosting.
- The Builder now runs the real Build Engine before deployment.
- The deployed site therefore uses validated build output.
- The Builder response now includes build metadata (build.id, type, status, entrypoint, file count).
- Builder usage records now include the build ID.

### Strong foundation already present
- Planner endpoint.
- AI generation.
- Existing-project context.
- Input/output size limits.
- Safe relative-path validation.
- Generated-secret detection.
- HTML quality review.
- Automatic repair.
- PostgreSQL persistence.
- Real Vite build engine with an allowlist of dependencies.
- Deployment versioning.
- Deployment history and rollback.
- Public site hosting.
- Credit accounting.
- Usage records.
- Security validation.
- Production readiness and VPS automation.

### Important missing or incomplete product features

| Priority | Feature | Current state | Recommendation |
|---|---|---|---|
| P0 | Atomic Builder transaction | Generation can consume credits before later persistence/build/deploy failure | Add compensation/refund or transactional job state |
| P0 | Build/deploy failure lifecycle | Files may remain saved when build/deploy fails | Add explicit build/deployment statuses and recovery |
| P1 | Preview before deploy | Public deployment is automatic | Add temporary preview/staging deployment |
| P1 | Builder version history | Hosting has deployment history, but Builder generation history is not first-class | Store generation/revision metadata |
| P1 | AI refine workflow | Existing project context is supported, but no dedicated revision/diff workflow | Add builder/refine with changed-file summary |
| P1 | Automated app tests | Review checks structure but does not execute generated behavior | Add smoke tests after build |
| P1 | Rate limiting | No dedicated per-key Builder rate limiter is present | Add API-key and IP rate limits |
| P1 | Build isolation | Builds run in the Core container | For stronger production isolation, move builds to a worker/sandbox |
| P2 | Custom domains | Hosting currently uses generated /sites/:slug URLs | Add domain mapping and certificate lifecycle |
| P2 | GitHub sync/export | No Builder-specific Git commit/export flow | Add repository export and optional GitHub integration |
| P2 | Asset/file upload | Project files are text-oriented | Add controlled binary asset storage |
| P2 | Collaboration/workspaces | API-key/project ownership only | Add users, workspaces, roles and permissions |
| P2 | AI memory/project knowledge | No dedicated persistent Builder knowledge/context store | Add project context index using embeddings |
| P3 | Template library | Planner has fixed project-type templates | Add reusable templates/components |
| P3 | Visual editor | Builder is prompt/API driven | Add visual editor after backend is stable |

## Architecture assessment

The Builder should remain separate from Runtime/Hosting: it generates and validates an application, while Build/Deploy/Hosting execute and serve the result. This separation is consistent with modern builder architectures that separate generation, validation, execution, logs and persistence.

## Production milestone recommendation

1. Finish the full smoke workflow.
2. Fix Builder credit/persistence failure recovery.
3. Add preview/staging.
4. Add post-build application smoke tests.
5. Add rate limiting.
6. Then move to VPS deployment and HTTPS.

Custom domains, GitHub export, collaboration and visual editing can follow after the production core is stable.

## Important note

The repository still contains local JSON fallback code in some storage modules for development without PostgreSQL. Production mode uses PostgreSQL through DATABASE_URL; the fallback should be removed or explicitly isolated before a final PostgreSQL-only production release to avoid ambiguity.