/**
 * Archived sessions section registered into `settings.section`: lists every
 * archived session (title from the session list) with a Restore action that
 * clears the session from the registry-global archive set. The list re-derives
 * from the `useWorkspaces` archive set, so a successful restore (broadcast by
 * the host as `host/archived-sessions-changed`) drops the row automatically.
 */

import React, { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UnarchiveResult } from '../types.ts'
import type { ArchiveLocaleKey } from './locales.ts'

/** Registration-side remote face provided by the section registration. */
export interface ArchiveSectionInjected {
  /** Clear one session id from the archive set; resolves with the remaining set. */
  readonly unarchive: (sessionId: string) => Promise<UnarchiveResult>
}

/** Full component props assembled by the Settings section renderer. */
export type ArchiveSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.archive'>
  & InjectFace<ArchiveSectionInjected>

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
  rowId: {
    fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-secondary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  restore: {
    boxSizing: 'border-box', flex: 'none', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '16px',
    padding: '5px 14px', font: 'inherit', fontSize: '13px', lineHeight: '20px',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
  },
  restoreDisabled: {
    background: 'var(--dsw-alias-interactive-bg-hover)',
    color: 'var(--dsw-alias-label-secondary)', cursor: 'not-allowed',
  },
  error: {
    fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)',
  },
}

/** Render the Archived sessions section. */
export function ArchiveSection({ t, useSessions, useWorkspaces, unarchive }: ArchiveSectionProps) {
  const archivedIds = useWorkspaces((state) => state.archivedSessionIds)
  const byId = useSessions((state) => state.byId)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const items = archivedIds.map((id) => ({
    id: String(id),
    title: byId[id]?.displayTitle ?? String(id),
  }))

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

  return (
    <div style={styles.section}>
      <h2 style={styles.title}>{t('title')}</h2>
      <p style={styles.description}>{t('description')}</p>
      {items.length === 0 ? (
        <div style={styles.empty}>{t('empty')}</div>
      ) : (
        <ul style={styles.list}>
          {items.map((item) => (
            <li key={item.id} style={styles.row}>
              <div style={styles.rowMain}>
                <div style={styles.rowTitle}>{item.title}</div>
                <div style={styles.rowId}>{item.id}</div>
              </div>
              <button
                type="button"
                style={pendingId === item.id ? { ...styles.restore, ...styles.restoreDisabled } : styles.restore}
                disabled={pendingId === item.id}
                onClick={() => onRestore(item.id)}
              >
                {pendingId === item.id ? t('restoring') : t('restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorId !== null && <div style={styles.error}>{t('restoreError')}</div>}
    </div>
  )
}
