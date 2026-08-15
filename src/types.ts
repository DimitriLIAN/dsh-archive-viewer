/**
 * Shared wire types between the host REST surface and the browser half.
 */

/** One unarchive request: the session to restore into the sidebar. */
export interface UnarchiveRequest {
  /** Session id currently in the registry-global archive set. */
  sessionId: string
}

/** Result of an unarchive: the remaining archive set (archive order kept). */
export interface UnarchiveResult {
  archivedSessionIds: string[]
}

/** One delete request: permanently remove an archived session's stored log. */
export interface DeleteRequest {
  /** Session id currently in the registry-global archive set. */
  sessionId: string
}

/** Result of a delete: whether the log was removed and the remaining archive set. */
export interface DeleteResult {
  /** Whether a session directory was actually removed from disk. */
  removed: boolean
  /** The removed session directory path, or null when nothing was removed. */
  path: string | null
  /** The remaining archive set (archive order kept). */
  archivedSessionIds: string[]
}

/** REST envelope carried by every /api2/archive response. */
export type ArchiveResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } }
