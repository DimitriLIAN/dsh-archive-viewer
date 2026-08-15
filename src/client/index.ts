/**
 * dsh-archive-viewer browser half: registers the "Archived sessions" settings
 * section. The list is composed locally from the standard `useSessions` +
 * `useWorkspaces` seats; restoring goes through the host's /api2/archive
 * REST surface (same-origin fetch).
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ArchiveResult, DeleteResult, UnarchiveResult } from '../types.ts'
import { ArchiveSection, type ArchiveSectionInjected } from './ArchiveSection.tsx'
import { en, zh, type ArchiveLocaleKey } from './locales.ts'

export type { ArchiveSectionInjected, ArchiveSectionProps } from './ArchiveSection.tsx'
export type { ArchiveLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Archived sessions section's copy. */
    'settings.archive': ArchiveLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.archive'

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale']

/** Base URL of the host REST surface. */
const BASE = '/api2/archive'

/** Call one REST op with a JSON body, unwrapping the ok envelope. */
async function call<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE}/${op}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`archive.${op}: HTTP ${response.status}`)
  }
  const envelope = await response.json() as ArchiveResult<T>
  if (!envelope.ok) {
    throw new Error(`archive.${op} failed: ${envelope.error.code}: ${envelope.error.message}`)
  }
  return envelope.value
}

/** Contribute the Archived sessions section to Settings. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-archive-viewer: dictionaries')
  const t = ctx.locale.bind(NS)

  const injected = (): ArchiveSectionInjected => ({
    unarchive: (sessionId) => call<UnarchiveResult>('unarchive', { sessionId }),
    remove: (sessionId) => call<DeleteResult>('delete', { sessionId }),
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'archive',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, ArchiveSection))
}
