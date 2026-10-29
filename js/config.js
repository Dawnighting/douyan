/* =========================================================
   斗研电竞俱乐部 · 积分系统 配置
   切换云开发环境只需要改 envId（换俱乐部账号时）
   ========================================================= */
window.APP_CONFIG = {
  clubName: "斗研电竞俱乐部",
  city: "重庆",
  contact: "到店找前台登记",

  /* GitHub 数据仓库（管理端保存时提交到这里，公开端从这里读取） */
  github: {
    owner: "Dawnighting",
    repo: "douyan",
    branch: "main",
    dataPath: "data/site.json"
  },

  /* 赛事类型 */
  eventTypes: ["周赛", "月赛", "其他"]
};
