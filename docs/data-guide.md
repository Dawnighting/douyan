# 数据结构与管理端 Token

## 数据文件

`data/site.json`：

```json
{
  "members": [{ "id": "...", "name": "张三", "nickname": "", "avatar": "", "active": true, "ts": 0 }],
  "events": [{ "id": "...", "name": "10月第4周周赛", "type": "周赛", "date": "2026-10-25", "ts": 0 }],
  "points": [{ "id": "...", "memberId": "...", "memberName": "张三", "eventId": "...", "eventName": "10月第4周周赛", "points": 30, "reason": "冠军", "ts": 0 }],
  "teachers": [{ "id": "...", "name": "老师A", "avatar": "", "mode": "经典", "characters": [{ "name": "卢克", "rank": "M2300" }], "teachingChars": ["卢克"], "points": 200, "pro": "", "bio": "", "active": true, "ts": 0 }],
  "redemptions": [],
  "updatedAt": "2026-10-29T00:00:00.000Z"
}
```

积分榜 = 对 `points` 求和；负分表示兑换扣分。

## 创建管理端 Token（一次性）

1. 打开 https://github.com/settings/personal-access-tokens/new
2. Token name 随意，Expiration 建议 90 天或 No expiration；
3. Repository access → Only select repositories → 选 `Dawnighting/douyan`；
4. Permissions → Repository permissions → **Contents: Read and write**（Metadata 自动只读）；
5. 生成后复制 `github_pat_...`，粘贴到管理端登录框（只存本机浏览器）。

## 迁移

- 导出的 JSON 即完整数据，换仓库/换域名只需替换 `data/site.json`；
- 历史版本全部在 git 提交记录里，可按 commit 回溯。
