## Plan: Clarify Client vs Samples Layout

The repository should expose one obvious reusable client surface while moving runnable demos and local servers into clearly named folders. The recommended approach keeps current behavior but reorganizes files into client, examples, and servers, then updates docs and scripts so engineers can copy client code directly and run samples independently.

**Steps**
1. Phase 1: Define target architecture and boundaries
2. Confirm and document the three top-level source areas: src/client for reusable API code, src/examples for end-to-end sample scripts, and src/servers for local proxy/webhook helper apps.
3. Define explicit in-scope behavior parity: no API contract changes, no env variable renames, no request signing behavior changes.
4. Define out-of-scope items for this pass: adding new API features, changing webhook semantics, introducing build tooling changes.
5. Phase 2: Restructure reusable client first
6. Move reusable API logic from src/lib/api.ts into src/client/api.ts and extract exported request/response types into src/client/types.ts. Depends on step 2.
7. Move authentication/signing and digest helpers from src/lib/utils.ts into src/client/auth.ts, keeping sample-only generators out of client. Depends on step 6.
8. Add src/client/index.ts as the single public entrypoint that re-exports stable client functions and types for drop-in use. Depends on steps 6-7.
9. Decide disposition of src/lib/env.ts: keep as internal helper referenced by examples/servers, or relocate to src/config/env.ts for neutral naming. Depends on step 2.
10. Phase 3: Rehome samples and local server scripts
11. Move runnable sample scripts from src root into src/examples and normalize names for readability (attachments-with-files, attachments-without-files). Parallel with step 9 after import paths are adjusted.
12. Move src/proxy-server.ts and src/webhook-server.ts into src/servers to separate infrastructure demos from API usage examples. Parallel with step 11.
13. Extract sample-data and fixture helper generators from src/lib/utils.ts into src/examples/common.ts so examples can share setup data without polluting client exports. Depends on step 7.
14. Remove or slim src/lib after migrations so it no longer appears as an ambiguous mixed-purpose folder. Depends on steps 9, 11, 12, 13.
15. Phase 4: Make usage path obvious in docs and scripts
16. Update README.md with a Start Here flow: Use client, Run examples, Run local servers, Use fixtures.
17. Add a concise client usage snippet in README that imports only from src/client/index.ts and calls one create/query function.
18. Update package.json scripts to point to src/examples and src/servers paths, preserving current runnable commands where possible. Depends on steps 11-12.
19. Add a brief folder map in README tying fixtures to example usage so engineers know fixtures are sample payload assets, not client dependencies.
20. Phase 5: Verify and stabilize
21. Run typecheck and each sample/server script path via package scripts to validate import rewrites and path changes. Depends on steps 11-18.
22. Verify that the client entrypoint exports all required functions currently consumed by examples (create, update, query, attachments).
23. Validate README quick-start by following it from a fresh clone mindset and confirming first successful API call path is obvious.

**Relevant files**
- src/lib/api.ts — source reusable API methods and currently embedded types to split and re-export.
- src/lib/utils.ts — separate auth/signing helpers from sample-data helpers.
- src/lib/env.ts — keep or relocate as shared runtime config helper.
- src/create-request.ts — move to examples and update imports.
- src/update-request.ts — move to examples and update imports.
- src/query-requests.ts — move to examples and update imports.
- src/add-attachments-to-request-with-files.ts — move/rename in examples.
- src/add-attachments-to-request-without-files.ts — move/rename in examples.
- src/proxy-server.ts — move to servers and update docs/scripts.
- src/webhook-server.ts — move to servers and update docs/scripts.
- README.md — add explicit navigation and quick-start usage.
- package.json — update script entry paths.
- fixtures/example.html — keep fixture location and reference from examples/docs.

**Verification**
1. Run repository typecheck command and ensure no unresolved imports after file moves.
2. Run each updated package script for examples and servers at least once to confirm paths and env loading.
3. Confirm README sections map exactly to folders and that a newcomer can identify drop-in client files in under one minute.
4. Confirm src/client/index.ts exports are sufficient so examples no longer import from internal helper paths.

**Decisions**
- Included: structural reorganization, import rewiring, docs and scripts updates, export-surface clarification.
- Excluded: API behavior changes, auth algorithm changes, webhook protocol changes, fixture format changes.
- Recommendation: prefer src/client naming over src/lib to signal intended external reuse.

**Further Considerations**
1. Keep backward-compatible script names in package.json (recommended) versus renaming scripts to match new file names.
2. Keep env helper centralized in one shared module (recommended) versus duplicate minimal env parsing in examples and servers.
3. Optionally add a small src/client/README.md focused only on copy/paste integration for external engineers.
