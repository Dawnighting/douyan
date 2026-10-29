# 数据库集合与权限

环境 ID：`douyan-d0gbsrsuw6c3e24f8`

## 需要创建的 5 个集合

| 集合 | 用途 | 主要字段 |
| --- | --- | --- |
| `members` | 会员 | name, nickname, avatar, active, ts |
| `events` | 赛事（周赛/月赛） | name, type, date, ts |
| `point_entries` | 积分流水 | memberId, memberName, eventId, eventName, points, reason, ts |
| `teachers` | 教学老师 | name, avatar, mode, characters[], teachingChars[], points, pro, bio, active, sort |
| `redemptions` | 兑换申请 | memberId, memberName, teacherId, teacherName, points, status, note, ts |

`characters` 结构：`[{ "name": "卢克", "rank": "M2300" }]`

## 安全规则

`members` / `events` / `point_entries` / `teachers`：

```json
{
  "read": true,
  "write": "auth.uid == '2115777526257623042'"
}
```

`redemptions`：

```json
{
  "read": "auth.uid == '2115777526257623042'",
  "write": "auth.uid == '2115777526257623042'"
}
```

## 迁移到新环境

1. 新环境创建同样的 5 个集合和规则（把 UID 换成新管理员 UID）；
2. 打开管理端 → 数据 → 导出 JSON 备份；
3. 用脚本/控制台把 JSON 导入新环境（或联系我写导入工具）；
4. 修改 `js/config.js` 里的 `envId` 和 `adminUid`，推送即可。
