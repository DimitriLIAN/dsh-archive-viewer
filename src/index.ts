/**
 * dsh-archive-viewer host service: one REST op on `ctx.webServer` that clears
 * a session id from the durable workspace registry's `archivedSessionIds` set.
 *
 * The official workspace RPC surface only exposes `archiveSession` (no
 * unarchive), so this plugin performs the symmetric write through the live
 * `workspaceRegistry` service — the same `setState` path `archiveSession`
 * uses internally. The write lands through `domain.global.set`, which is the
 * exact mutation the host gateway watches to broadcast
 * `host/archived-sessions-changed`; the sidebar therefore re-projects the
 * restored session without a reload. No DSH core code is modified.
 *
 * The browser half composes the list itself from the standard `useSessions`
 * + `useWorkspaces` seats (titles come from the session list), so this host
 * surface only needs the write op.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ArchiveResult, UnarchiveRequest, UnarchiveResult } from './types.ts'

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

/** Mount the REST surface. Returns the route disposer. */
export function registerRoutes(ctx: Context): () => void {
  const webServer = ctx.get('webServer') as { register(route: WebRoute): () => void } | undefined
  if (webServer === undefined) return () => {}

  const handler: WebRoute['handler'] = (async (
    req: NodeJS.ReadableStream & { url?: string },
    res: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void },
  ): Promise<void> => {
    try {
      const body = (await readJsonBody(req)) as Partial<UnarchiveRequest>
      const sessionId = typeof body['sessionId'] === 'string' ? body['sessionId'].trim() : ''
      if (sessionId === '') {
        sendJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'missing sessionId' } })
        return
      }
      const registry = ctx.get('workspaceRegistry') as unknown as ArchiveRegistryFace
      const archivedSessionIds = await unarchive(registry, sessionId)
      const result: ArchiveResult<UnarchiveResult> = { ok: true, value: { archivedSessionIds } }
      sendJson(res, 200, result)
    } catch (error: unknown) {
      sendJson(res, 400, {
        ok: false,
        error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
      })
    }
  }) as unknown as WebRoute['handler']

  return webServer.register({ kind: 'exact', path: `${ROUTE_PREFIX}/unarchive`, handler })
}

/** Stable Cordis plugin name. */
export const name = 'dsh-archive-viewer'

/** Plugin entry: mount the REST route once the web server and registry are up. */
export function apply(ctx: Context): void {
  ctx.inject(['webServer', 'workspaceRegistry'], (webCtx: Context) => {
    webCtx.effect(() => registerRoutes(webCtx), 'dsh-archive-viewer: routes')
  })
}

// Function-plugin form: no default export (mixing forms makes the Loader
// discard the named apply).
