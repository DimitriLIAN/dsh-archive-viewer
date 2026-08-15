/**
 * dsh-archive-viewer host service: two REST ops on `ctx.webServer`.
 *
 * - `unarchive`: clears a session id from the durable workspace registry's
 *   `archivedSessionIds` set — the symmetric write to `archiveSession` through
 *   the live `workspaceRegistry` (same `setState` path, so the gateway still
 *   broadcasts `host/archived-sessions-changed` and the sidebar re-projects).
 * - `delete`: permanently removes an archived session's stored log via the
 *   `sessionPersistence.locate()` location hint, then clears the id from the
 *   archive set. On the next DSH restart the workspace bootstrap drops the
 *   dangling `sessionIds` slot (its header is gone), so the deletion settles.
 *
 * Both ops go through host services and the filesystem only — no DSH core
 * source is modified.
 */

import { existsSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ArchiveResult, DeleteResult, UnarchiveResult } from './types.ts'

export type * from './types.ts'

/** Route prefix for the REST surface. */
export const ROUTE_PREFIX = '/api2/archive'

/**
 * Runtime face of the workspace registry this plugin needs. `state` and
 * `setState` are declared private on the WorkspaceRegistry type but exist at
 * runtime (TypeScript `private` is compile-time only); this narrow interface
 * keeps the dependency type-safe without importing the whole package.
 */
interface ArchiveRegistryFace {
  readonly state: {
    readonly initialized: boolean
    readonly workspaceIds: readonly string[]
    readonly archivedSessionIds: readonly string[]
    readonly pendingMutation?: unknown
  }
  setState(state: unknown): Promise<void>
}

/** Runtime face of the session-persistence service: locate one session's log. */
interface SessionPersistenceFace {
  list(): Promise<{ id: string; cwd?: string }[]>
  locate(meta: { id: string; cwd?: string }): { kind: string; path: string } | undefined
}

/** Runtime face of the storage-domain facility: drop one projcache record. */
interface StorageDomainFace {
  get(name: string): { table(name: string): { delete(key: string): Promise<unknown> } } | undefined
}

/** Read a JSON request body (bounded). */
function readJsonBody(req: NodeJS.ReadableStream & { destroy?(): void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) { reject(new Error('request body too large')); req.destroy?.() }
      else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    req.on('error', reject)
  })
}

/** Write a JSON response. */
function sendJson(
  res: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void },
  status: number,
  value: unknown,
): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

/**
 * Remove one session id from the archive set through the live registry.
 * Idempotent: an id absent from the set resolves without writing. The state
 * spread keeps every other durable field (`initialized`, `workspaceIds`,
 * `pendingMutation`) intact so the domain validator accepts the write.
 */
async function unarchive(registry: ArchiveRegistryFace, sessionId: string): Promise<string[]> {
  const state = registry.state
  if (!state.archivedSessionIds.includes(sessionId)) return [...state.archivedSessionIds]
  const archivedSessionIds = state.archivedSessionIds.filter((id) => id !== sessionId)
  await registry.setState({ ...state, archivedSessionIds })
  return [...archivedSessionIds]
}

/**
 * Permanently delete an archived session's stored log, then clear it from the
 * archive set. The log removal is best-effort (a missing/foreign backend logs
 * nothing); the archive-set clear always runs so the UI never keeps a ghost row.
 */
async function deleteArchived(ctx: Context, sessionId: string): Promise<DeleteResult> {
  let removed = false
  let path: string | null = null
  try {
    const persistence = ctx.get('sessionPersistence') as unknown as SessionPersistenceFace | undefined
    if (persistence !== undefined) {
      const headers = await persistence.list()
      const header = headers.find((h) => String(h.id) === sessionId)
      if (header !== undefined) {
        const location = persistence.locate({ id: header.id, cwd: header.cwd })
        if (location !== undefined && location.path !== '') {
          const dir = dirname(location.path)
          if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true })
            removed = true
            path = dir
          }
        }
      }
    }
  } catch (error: unknown) {
    console.warn('dsh-archive-viewer: session log removal failed:', error)
  }

  // Drop the orphaned projection-cache record (title/stat rows) so the deleted
  // session leaves no dangling metadata behind.
  try {
    const storageDomain = ctx.get('storageDomain') as unknown as StorageDomainFace | undefined
    const projcache = storageDomain?.get('session_projcache')
    if (projcache !== undefined) {
      await projcache.table('sessions').delete(sessionId)
    }
  } catch (error: unknown) {
    console.warn('dsh-archive-viewer: projcache cleanup failed:', error)
  }

  const registry = ctx.get('workspaceRegistry') as unknown as ArchiveRegistryFace
  const state = registry.state
  const archivedSessionIds = state.archivedSessionIds.filter((id) => id !== sessionId)
  if (archivedSessionIds.length !== state.archivedSessionIds.length) {
    await registry.setState({ ...state, archivedSessionIds })
  }

  return { removed, path, archivedSessionIds: [...archivedSessionIds] }
}

/** Mount the REST surface. Returns the route disposer. */
export function registerRoutes(ctx: Context): () => void {
  const webServer = ctx.get('webServer') as { register(route: WebRoute): () => void } | undefined
  if (webServer === undefined) return () => {}

  const makeHandler = (op: 'unarchive' | 'delete'): WebRoute['handler'] => (async (
    req: NodeJS.ReadableStream & { url?: string },
    res: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void },
  ): Promise<void> => {
    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>
      const sessionId = typeof body['sessionId'] === 'string' ? body['sessionId'].trim() : ''
      if (sessionId === '') {
        sendJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'missing sessionId' } })
        return
      }
      if (op === 'unarchive') {
        const registry = ctx.get('workspaceRegistry') as unknown as ArchiveRegistryFace
        const archivedSessionIds = await unarchive(registry, sessionId)
        const result: ArchiveResult<UnarchiveResult> = { ok: true, value: { archivedSessionIds } }
        sendJson(res, 200, result)
      } else {
        const result: ArchiveResult<DeleteResult> = { ok: true, value: await deleteArchived(ctx, sessionId) }
        sendJson(res, 200, result)
      }
    } catch (error: unknown) {
      sendJson(res, 400, {
        ok: false,
        error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
      })
    }
  }) as unknown as WebRoute['handler']

  const disposers = [
    webServer.register({ kind: 'exact', path: `${ROUTE_PREFIX}/unarchive`, handler: makeHandler('unarchive') }),
    webServer.register({ kind: 'exact', path: `${ROUTE_PREFIX}/delete`, handler: makeHandler('delete') }),
  ]
  return () => { for (const dispose of disposers) dispose() }
}

/** Stable Cordis plugin name. */
export const name = 'dsh-archive-viewer'

/** Plugin entry: mount the REST routes once the web server and registry are up. */
export function apply(ctx: Context): void {
  ctx.inject(['webServer', 'workspaceRegistry', 'sessionPersistence'], (webCtx: Context) => {
    webCtx.effect(() => registerRoutes(webCtx), 'dsh-archive-viewer: routes')
  })
}

// Function-plugin form: no default export (mixing forms makes the Loader
// discard the named apply).
