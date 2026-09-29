# orca-link 桌面版左上角 inset 证据（2026-09-29）

本组两张图对照的是 `skins/orca-link/hooks.mjs` 的 `--orca-shell-top-inset` 重测修复：
皮肤暂停依赖**挂载那一刻**量到的 inset 之后，"定价信号灯"（LOW 徽标）会停在
浏览器壳的位置（y=46），而字标行已被桌面版 52px 标题条推到 y=40——徽标于是压在
DSH 字标上方，就是用户回报的左上角错位。

## 拍摄方法

- 宿主：本机运行中的 DSH 桌面版宿主（`127.0.0.1:19387`），用宿主自身的鉴权
  cookie 访问；页面以 `<html data-platform="darwin">` 提供，并 stub
  `window.dshDesktop.keyboard`（桌面壳的快捷键桥），使客户端走 darwin 布局
  渲染官方 `.topStrip` + `.logoRow`。
- 换钩子方式：不落盘，用请求拦截把 `/api/skin-center/v2/skins/orca-link/hooks.mjs`
  的响应替换为待测那一份 hook 源码（before = `$DSH_HOME/skins/orca-link/hooks.mjs`，
  after = 本分支 `skins/orca-link/hooks.mjs`），页面加载后即运行该份 hook。
- 复现机制：boot 时用 `<style>` 把 `.yuWXda_topStrip` 钉成 `height: 0`（模拟
  "样式晚于 DOM 到达"），页面稳定后移除该 style——标题条在没有任何 DOM 变更的情况下
  变成 52px，字标行下移 34px。
- 视口 1100x760，裁切 0,0 460x240（deviceScaleFactor 2）。原生红黄绿交通灯由 macOS
  绘制，不在页面里，所以两张图左上角都是空的。

## 量到的差异

| 项 | before（已发布 hook） | after（本分支 hook） |
| --- | --- | --- |
| `--orca-shell-top-inset`（样式落地后） | `0px` | `34px` |
| `.yuWXda_logoRow` y | 40 | 40 |
| `[data-orca-link-wordmark]` y | 55 | 55 |
| `[data-orca-link-price-light]` y | **46**（压在字标上方） | **80**（字标行内座位） |

浏览器壳（无 `data-platform="darwin"`）在两份 hook 下都是 inset `0px`、灯 y=46。

## 文件

| 文件 | 内容 |
| --- | --- |
| `orca-link-desktop-inset-before.png` | 已发布 hook：样式落地后 inset 仍为 0，LOW 徽标浮在 DSH 字标上方 |
| `orca-link-desktop-inset-after.png` | 本分支 hook：inset 跟随布局变成 34px，LOW 徽标回到字标左下 |
