# dsh-archive-viewer

[English](README.md) | 中文

一个 DeepSeek Harness（DSH）插件，在 Web 设置里新增「归档会话」页面：按文件夹分组列出所有被归档的对话，提供一键「恢复」和二次确认的「删除」。恢复会把该会话从全局归档集合中移除，使它**无需刷新页面**就回到侧边栏；删除会永久移除该会话的存储日志。

不修改任何 DSH 核心代码：host 半部分在 `ctx.webServer` 上注册两个 REST 接口（`/api2/archive/unarchive` + `/api2/archive/delete`），通过 live 的 `workspaceRegistry` 和 `sessionPersistence` 服务完成；browser 半部分用标准的 `useSessions` + `useWorkspaces` 座位组合列表，并注册一个 `settings.section`（id `archive`）。

## 为什么需要它

DSH 官方的 workspace 接口只暴露了 `archiveSession`——没有取消归档、也没有删除的 RPC，而且 Web 界面把归档会话从所有分组里隐藏，找不到、恢复不了、也删不掉。这个插件在不碰 DSH 核心的前提下补上了这个缺口。

## 安装

```bash
dsh plugin add --profile web github:DimitriLIAN/dsh-archive-viewer
```

然后重启 `web` profile（`dsh --profile web`）让 bundle 层加载。打开 **设置 → 归档会话** 即可查看、恢复或删除归档对话。

## 工作原理

| 层 | 机制 |
|---|---|
| Host 半部分 | `ctx.inject(['webServer', 'workspaceRegistry', 'sessionPersistence'])` → `ctx.webServer.register()` 注册 `unarchive` + `delete` |
| 恢复 | 通过 `setState` 把 id 从 `archivedSessionIds` 移除 → `domain.global.set` → 广播 `host/archived-sessions-changed` |
| 删除 | `sessionPersistence.locate()` → `rmSync` 删除会话目录，再把 id 从 `archivedSessionIds` 移除 |
| Browser 半部分 | `settings.section` 槽位（id `archive`），列表来自 `useWorkspaces(archivedSessionIds)` + `useSessions(byId)` |

## 构建

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc`（声明文件）+ `tsdown`（`__ModuleLoader__.load` client 包）。

## 已知限制

- **调用了一个运行期可见的方法**——官方 workspace RPC 没有取消归档，因此 host 半部分调用 `workspaceRegistry.setState`（类型中声明为 `private`，运行期存在）来执行 `archiveSession` 的逆操作。它完全复刻了 `archiveSession` 自身的写入路径。
- **删除不可恢复**——删除会从磁盘移除会话日志，没有撤销。
- **删除在重启后彻底生效**——归档列表会立即移除该行，但侧边栏的会话列表和 workspace 的 `sessionIds` 槽位要等下一次 DSH 重启（bootstrap 检测到 header 缺失）才清理干净。DSH 存储是 append-only，没有官方的会话删除 RPC。
