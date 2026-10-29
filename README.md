# 斗研电竞俱乐部 · 积分系统

重庆斗研电竞俱乐部的积分系统：周赛/月赛积分登记、积分榜、积分兑换教学。

线上地址：**https://dawnighting.github.io/douyan/**（管理端：**/admin.html**）

## 架构（零成本）

- 页面托管：GitHub Pages
- 数据文件：`data/site.json`（仓库里的 JSON）
- 管理端保存：通过 GitHub API 自动提交一次 commit，Pages 约 1 分钟后生效
- 不需要服务器、不需要数据库、不需要云开发环境

## 页面

- `index.html`：公开端（积分榜 + 积分教学卡片）
- `admin.html`：管理端（Token 登录后登记积分、管理成员/老师、审核兑换、导出备份）

## 管理端用法

1. 打开 `admin.html`，填入一个 **Fine-grained GitHub Token**（只对 `Dawnighting/douyan` 仓库有 `Contents: Read and write` 权限）；
2. 「积分登记」：先选/新建赛事 → 输入成员名字 + 积分 → 回车继续下一条；
3. 多人成绩可粘贴到「批量导入」，每行 `名字 积分 [备注]`；
4. 「成员」「老师」可增删改；「兑换」审核通过后自动扣积分；
5. 改完点右上角 **「保存到线上」**（提交到 GitHub，约 1 分钟生效）；
6. 「数据」页可导出全部 JSON 备份。

Token 只保存在你这台设备的浏览器里，不会写进仓库。

## 迁移 / 换仓库

1. 管理端「数据」→ 导出 JSON；
2. 在 `js/config.js` 里改 `github.owner / repo / branch`；
3. 把导出的 JSON 覆盖到新仓库的 `data/site.json`，推送即可。

## 本地预览

```bash
cd E:\projects\douyan
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`（直接双击 index.html 时浏览器会拦截本地 JSON 读取）。

数据结构说明见 [docs/data-guide.md](docs/data-guide.md)。
