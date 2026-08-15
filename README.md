# dsh-archive-viewer

English | [中文](README.zh.md)

A DeepSeek Harness (DSH) plugin that adds an **Archived sessions** page to Web settings, listing every archived conversation with a one-click **Restore** action. Restoring clears the session from the registry-global archive set, so it reappears in the sidebar at its original position — without a page reload.

No DSH core is modified: the host half registers one REST op on `ctx.webServer` (`/api2/archive/unarchive`) that performs the symmetric write to `archiveSession` through the live `workspaceRegistry` service; the browser half composes the list from the standard `useSessions` + `useWorkspaces` seats and registers a `settings.section` (id `archive`).

## Why this exists

DSH's official workspace surface only exposes `archiveSession` — there is no unarchive RPC, and the Web UI hides archived sessions from every grouping with no way to find or restore them. This plugin fills that gap without touching DSH core.

## Install

```bash
dsh plugin add --profile web github:DimitriLIAN/dsh-archive-viewer
```

Then restart the `web` profile (`dsh --profile web`) so the bundle layer loads. Open **Settings → Archived sessions** to list and restore archived conversations.

## How it works

| Layer | Mechanism |
|---|---|
| Host half | `ctx.inject(['webServer', 'workspaceRegistry'])` → `ctx.webServer.register()` for `unarchive` |
| Unarchive | remove the id from `archivedSessionIds` via `setState` → `domain.global.set` → `host/archived-sessions-changed` broadcast |
| Browser half | `settings.section` slot (id `archive`), list from `useWorkspaces(archivedSessionIds)` + `useSessions(byId)` |
| Restore | `fetch` `/api2/archive/unarchive`; the sidebar re-projects on the broadcast |

## Build

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc` (declarations) + `tsdown` (the `__ModuleLoader__.load` client bundle).

## Known limitations

- **Reaches a runtime-visible method** — the official workspace RPC has no unarchive, so the host half calls `workspaceRegistry.setState` (declared `private` in the types, present at runtime) to perform the inverse of `archiveSession`. It mirrors `archiveSession`'s own write path exactly, including the `host/archived-sessions-changed` broadcast.
