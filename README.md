# dsh-archive-viewer

English | [中文](README.zh.md)

A DeepSeek Harness (DSH) plugin that adds an **Archived sessions** page to Web settings, listing every archived conversation grouped by its folder with a one-click **Restore** and a two-tap **Delete**. Restoring clears the session from the registry-global archive set so it reappears in the sidebar; deleting permanently removes the stored session log.

No DSH core is modified: the host half registers two REST ops on `ctx.webServer` (`/api2/archive/unarchive` + `/api2/archive/delete`) over the live `workspaceRegistry` and `sessionPersistence` services; the browser half composes the list from the standard `useSessions` + `useWorkspaces` seats and registers a `settings.section` (id `archive`).

## Why this exists

DSH's official workspace surface only exposes `archiveSession` — there is no unarchive or delete RPC, and the Web UI hides archived sessions from every grouping with no way to find, restore, or remove them. This plugin fills that gap without touching DSH core.

## Install

```bash
dsh plugin add --profile web github:DimitriLIAN/dsh-archive-viewer
```

Then restart the `web` profile (`dsh --profile web`) so the bundle layer loads. Open **Settings → Archived sessions** to list, restore, or delete archived conversations.

## How it works

| Layer | Mechanism |
|---|---|
| Host half | `ctx.inject(['webServer', 'workspaceRegistry', 'sessionPersistence'])` → `ctx.webServer.register()` for `unarchive` + `delete` |
| Restore | remove the id from `archivedSessionIds` via `setState` → `domain.global.set` → `host/archived-sessions-changed` broadcast |
| Delete | `sessionPersistence.locate()` → `rmSync` the session directory, then clear the id from `archivedSessionIds` |
| Browser half | `settings.section` slot (id `archive`), list from `useWorkspaces(archivedSessionIds)` + `useSessions(byId)` |

## Build

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc` (declarations) + `tsdown` (the `__ModuleLoader__.load` client bundle).

## Known limitations

- **Reaches a runtime-visible method** — the official workspace RPC has no unarchive, so the host half calls `workspaceRegistry.setState` (declared `private` in the types, present at runtime) to perform the inverse of `archiveSession`. It mirrors `archiveSession`'s own write path exactly.
- **Delete is permanent** — deleting removes the session log from disk with no undo.
- **Delete settles on restart** — the archive list drops the row immediately, but the sidebar's session list and the workspace `sessionIds` slot finish clearing on the next DSH restart (the bootstrap detects the missing header). DSH storage is append-only and has no official session-delete RPC.
