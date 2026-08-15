# dsh-archive-viewer

[English](README.md) | 中文

一个 DeepSeek Harness（DSH）插件，在 Web 设置里新增「归档会话」页面：列出所有被归档的对话，并提供一键「恢复」。恢复会把该会话从全局归档集合中移除，使它**无需刷新页面**就回到侧边栏原位置。

不修改任何 DSH 核心代码：host 半部分在 `ctx.webServer` 上注册一个 REST 接口（`/api2/archive/unarchive`），通过 live 的 `workspaceRegistry` 服务执行与 `archiveSession` 对称的写入；browser 半部分用标准的 `useSessions` + `useWorkspaces` 座位组合列表，并注册一个 `settings.section`（id `archive`）。

## 为什么需要它

DSH 官方的 workspace 接口只暴露了 `archiveSession`——没有取消归档的 RPC，而且 Web 界面把归档会话从所有分组里隐藏，找不到也恢复不了。这个插件在不碰 DSH 核心的前提下补上了这个缺口。

## 安装

```bash
dsh plugin add --profile web github:DimitriLIAN/dsh-archive-viewer
```

然后重启 `web` profile（`dsh --profile web`）让 bundle 层加载。打开 **设置 → 归档会话** 即可查看并恢复归档对话。

## 工作原理

| 层 | 机制 |
|---|---|
| Host 半部分 | `ctx.inject(['webServer', 'workspaceRegistry'])` → `ctx.webServer.register()` 注册 `unarchive` |
| 取消归档 | 通过 `setState` 把 id 从 `archivedSessionIds` 移除 → `domain.global.set` → 广播 `host/archived-sessions-changed` |
| Browser 半部分 | `settings.section` 槽位（id `archive`），列表来自 `useWorkspaces(archivedSessionIds)` + `useSessions(byId)` |
| 恢复 | `fetch` `/api2/archive/unarchive`；侧边栏收到广播后自动重新投影 |

## 构建

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc`（声明文件）+ `tsdown`（`__ModuleLoader__.load` client 包）。

## 已知限制

- **调用了一个运行期可见的方法**——官方 workspace RPC 没有取消归档，因此 host 半部分调用 `workspaceRegistry.setState`（类型中声明为 `private`，运行期存在）来执行 `archiveSession` 的逆操作。它完全复刻了 `archiveSession` 自身的写入路径，包括 `host/archived-sessions-changed` 广播。
