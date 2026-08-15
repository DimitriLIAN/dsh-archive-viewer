/**
 * Archived sessions section registered into `settings.section`: lists every
 * archived session grouped by its owning workspace (folder), showing each
 * session's title and last-updated time. Each row offers Restore (clear the
 * archive flag) and Delete (permanently remove the stored log). The list
 * re-derives from the `useWorkspaces` archive set, so a successful restore or
 * delete (broadcast by the host as `host/archived-sessions-changed`) drops the
 * row automatically.
 */

import React, { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { DeleteResult, UnarchiveResult } from '../types.ts'
import type { ArchiveLocaleKey } from './locales.ts'

/** Registration-side remote face provided by the section registration. */
export interface ArchiveSectionInjected {
  /** Clear one session id from the archive set; resolves with the remaining set. */
  readonly unarchive: (sessionId: string) => Promise<UnarchiveResult>
  /** Permanently delete one archived session's stored log. */
  readonly remove: (sessionId: string) => Promise<DeleteResult>
}

/** Full component props assembled by the Settings section renderer. */
export type ArchiveSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.archive'>
  & InjectFace<ArchiveSectionInjected>

/** One archived session row inside a folder group. */
interface ArchivedItem {
  id: string
  title: string
  updatedAt: number | undefined
}

/** One folder group of archived sessions. */
interface ArchiveGroup {
  key: string
  folder: string
  items: ArchivedItem[]
}

/** Basename across both Windows and POSIX separators (trailing separators ignored). */
function basename(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

/** Format an epoch-ms timestamp as a local `YYYY-MM-DD HH:mm`. */
function formatTime(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Official --dsw-* token styles (mirrors the built-in settings sections). */
const styles: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    maxWidth: '720px', color: 'var(--dsw-alias-label-primary)',
  },
  title: {
    margin: 0, fontSize: '16px', fontWeight: 500, lineHeight: '24px',
    color: 'var(--dsw-alias-label-primary)',
  },
  description: {
    margin: 0, fontSize: '14px', lineHeight: '22px',
    color: 'var(--dsw-alias-label-tertiary)',
  },
  empty: {
    fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)',
  },
  group: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '13px', fontWeight: 500, lineHeight: '20px',
    color: 'var(--dsw-alias-label-secondary)',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    margin: 0, padding: 0, listStyle: 'none',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '12px',
    padding: '12px 14px',
  },
  rowMain: {
    display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1,
  },
  rowTitle: {
    fontSize: '14px', fontWeight: 500, lineHeight: '22px',
    color: 'var(--dsw-alias-label-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  rowTime: {
    fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)',
  },
  actions: {
    display: 'flex', alignItems: 'center', gap: '6px', flex: 'none',
  },
  restore: {
    boxSizing: 'border-box', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '16px',
    padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
  },
  restoreDisabled: {
    background: 'var(--dsw-alias-interactive-bg-hover)',
    color: 'var(--dsw-alias-label-secondary)', cursor: 'not-allowed',
  },
  delete: {
    boxSizing: 'border-box', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-state-error-primary)', borderRadius: '16px',
    padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    background: 'transparent',
    color: 'var(--dsw-alias-state-error-primary)',
  },
  deleteConfirm: {
    background: 'var(--dsw-alias-state-error-primary)',
    color: '#ffffff',
  },
  deleteDisabled: {
    opacity: 0.55, cursor: 'not-allowed',
  },
  cancel: {
    boxSizing: 'border-box', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '16px',
    padding: '5px 12px', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary)',
  },
  error: {
    fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)',
  },
}

/** Render the Archived sessions section, grouped by owning folder. */
export function ArchiveSection({ t, useSessions, useWorkspaces, unarchive, remove }: ArchiveSectionProps) {
  const archivedIds = useWorkspaces((state) => state.archivedSessionIds)
  const workspaces = useWorkspaces((state) => state.items)
  const byId = useSessions((state) => state.byId)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  // session id → owning workspace (archived sessions keep their account slot).
  const workspaceBySession = new Map<string, WorkspaceView>()
  for (const ws of workspaces) {
    for (const sid of ws.sessionIds) workspaceBySession.set(String(sid), ws)
  }

  // Group archived sessions by folder, preserving archive order within a group.
  const groupMap = new Map<string, ArchiveGroup>()
  for (const sid of archivedIds) {
    const summary = byId[sid]
    const ws = workspaceBySession.get(String(sid))
    const key = ws !== undefined ? String(ws.workspaceId) : `unowned:${String(sid)}`
    let group = groupMap.get(key)
    if (group === undefined) {
      const folder = ws !== undefined
        ? ws.title
        : (summary?.cwd !== undefined ? basename(summary.cwd) : t('unowned'))
      group = { key, folder, items: [] }
      groupMap.set(key, group)
    }
    group.items.push({
      id: String(sid),
      title: summary?.displayTitle ?? String(sid),
      updatedAt: summary?.updatedAt,
    })
  }
  const groups = [...groupMap.values()]

  const onRestore = (id: string): void => {
    setPendingId(id)
    setErrorId(null)
    void unarchive(id).then(() => {
      setPendingId(null)
    }).catch(() => {
      setPendingId(null)
      setErrorId(id)
    })
  }

  const onDelete = (id: string): void => {
    setDeletingId(id)
    setErrorId(null)
    void remove(id).then(() => {
      setDeletingId(null)
      setConfirmId(null)
    }).catch(() => {
      setDeletingId(null)
      setConfirmId(null)
      setErrorId(id)
    })
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.title}>{t('title')}</h2>
      <p style={styles.description}>{t('description')}</p>
      {groups.length === 0 ? (
        <div style={styles.empty}>{t('empty')}</div>
      ) : (
        groups.map((group) => (
          <div key={group.key} style={styles.group}>
            <div style={styles.groupHeader}>
              <span>📁</span>
              <span>{group.folder}</span>
            </div>
            <ul style={styles.list}>
              {group.items.map((item) => {
                const confirming = confirmId === item.id
                const busy = pendingId === item.id || deletingId === item.id
                return (
                  <li key={item.id} style={styles.row}>
                    <div style={styles.rowMain}>
                      <div style={styles.rowTitle}>{item.title}</div>
                      {item.updatedAt !== undefined && (
                        <div style={styles.rowTime}>{formatTime(item.updatedAt)}</div>
                      )}
                    </div>
                    <div style={styles.actions}>
                      {confirming && (
                        <button
                          type="button"
                          style={styles.cancel}
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                        >
                          {t('cancel')}
                        </button>
                      )}
                      <button
                        type="button"
                        style={confirming ? { ...styles.delete, ...styles.deleteConfirm, ...(busy ? styles.deleteDisabled : {}) } : { ...styles.delete, ...(busy ? styles.deleteDisabled : {}) }}
                        disabled={busy}
                        onClick={() => {
                          if (confirming) onDelete(item.id)
                          else setConfirmId(item.id)
                        }}
                      >
                        {deletingId === item.id ? t('deleting') : confirming ? t('deleteConfirm') : t('delete')}
                      </button>
                      <button
                        type="button"
                        style={busy ? { ...styles.restore, ...styles.restoreDisabled } : styles.restore}
                        disabled={busy}
                        onClick={() => onRestore(item.id)}
                      >
                        {pendingId === item.id ? t('restoring') : t('restore')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
      {errorId !== null && <div style={styles.error}>{t('restoreError')}</div>}
    </div>
  )
}
