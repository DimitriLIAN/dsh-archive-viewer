/** `settings.archive` namespace dictionaries (the Archived sessions section copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '归档会话',
  'title': '归档会话',
  'description': '按文件夹分组的归档会话。可以「恢复」回侧边栏，或「删除」永久清除。',
  'empty': '没有归档的会话。',
  'restore': '恢复',
  'restoring': '恢复中…',
  'restoreError': '操作失败，请稍后重试。',
  'unowned': '未归属的会话',
  'delete': '删除',
  'deleteConfirm': '确认删除',
  'cancel': '取消',
  'deleting': '删除中…',
} satisfies Record<string, string>

/** The settings.archive namespace key union. */
export type ArchiveLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Archived sessions',
  'title': 'Archived sessions',
  'description': 'Archived sessions grouped by folder. Restore to the sidebar, or delete permanently.',
  'empty': 'No archived sessions.',
  'restore': 'Restore',
  'restoring': 'Restoring…',
  'restoreError': 'Operation failed; try again later.',
  'unowned': 'Unowned sessions',
  'delete': 'Delete',
  'deleteConfirm': 'Confirm',
  'cancel': 'Cancel',
  'deleting': 'Deleting…',
} satisfies Record<ArchiveLocaleKey, string>
