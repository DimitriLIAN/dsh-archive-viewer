/** `settings.archive` namespace dictionaries (the Archived sessions section copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '归档会话',
  'title': '归档会话',
  'description': '按文件夹分组的归档会话，点击「恢复」即可把它放回侧边栏原位置。',
  'empty': '没有归档的会话。',
  'restore': '恢复',
  'restoring': '恢复中…',
  'restoreError': '恢复失败，请稍后重试。',
  'unowned': '未归属的会话',
} satisfies Record<string, string>

/** The settings.archive namespace key union. */
export type ArchiveLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Archived sessions',
  'title': 'Archived sessions',
  'description': 'Archived sessions grouped by folder. Restore one to put it back in the sidebar.',
  'empty': 'No archived sessions.',
  'restore': 'Restore',
  'restoring': 'Restoring…',
  'restoreError': 'Failed to restore; try again later.',
  'unowned': 'Unowned sessions',
} satisfies Record<ArchiveLocaleKey, string>
