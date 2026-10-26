# DSH Skill Cockpit (研发中枢驾驶舱)

一个专为 **DeepSeek Harness (DSH)** 打造的技能分类增强与工作台中枢插件。

解决 Skill 过多时斜杠菜单（`/`）平铺繁杂、查找困难的问题，并提供右侧中枢面板（Cockpit）。

---

## ✨ 核心特性

1. **⚡ 斜杠菜单自定义分组 (`/`)**
   - 告别上百个 Skill 平铺堆积：打出 `/` 时自动按分组折叠展示，并显示各分类内的技能数量。
   - **Tab 二级钻取**：选中分类行按 `Tab` 键即可钻入该分类查看细项，带面包屑导航。
   - **穿透搜索**：输入关键字时实时全局检索，命中的技能自动标注所属分组标签。
2. **🎯 完全可自定义的分组引擎**
   - 内置智能分类规则（`gstack` 专属工作流组、鸿蒙/ArkUI、漫剧/视听、编剧文学、工程手艺、产品策划、运营增长、通用工具）。
   - 支持通过 `localStorage['dsh.cockpit.config']` 自定义组名、图标（Emoji）、排序权重与通配符匹配规则。
3. **🈶 中文介绍层**
   - 技能 frontmatter 大多是英文：菜单行显示**中文名**，原始英文标识保留在右侧（`无头浏览器 browse`），选中后插入的仍是 `browse`，不会改变实际调用的技能。
   - 支持中文搜索：打 `/浏览器` 就能找到 `browse`。
   - 自带 154 个技能里 83 条人工中文化；剩下的本来就有中文简介，直接沿用。可用 `localStorage['dsh.cockpit.zh']` 覆盖任意一条。
4. **📊 驾驶舱面板 (Cockpit Panel)**
   - 挂载于 DSH 侧边栏/右侧栏，分类浏览所有可用技能与 MCP 工具，支持一键点击填入。
   - 实时监控后台命令/编译进程，一览无余。

---

## 🛠️ 安装方法

DSH 的插件不是一个目录放进去就生效的，要同时满足三件事，**并且重启 DSH**（host 只在启动时扫描已加载的 Loader 条目，刷新页面不够）。

以 `desktop` profile 为例（`$HOME\.dsh\profiles\desktop`）：

1. **链接包目录**（开发时用 junction 指向本仓库，改完不用重装）：

   ```powershell
   New-Item -ItemType Junction -Path "$HOME\.dsh\plugins\dsh-cockpit" -Target "G:\AI\Claude-Workspace\Projects\dsh-cockpit"
   ```

2. **在 profile 的 `package.json` 里声明依赖**：

   ```json
   "@local/dsh-cockpit": "link:../../plugins/dsh-cockpit"
   ```

   然后在该 profile 目录里装一次，让 `node_modules/@local/dsh-cockpit` 真的存在：

   ```powershell
   node "G:\AI\Dsh\resources\runtime\pnpm\bin\pnpm.mjs" install
   ```

3. **在 profile 的 `cordis.patch.yml` 里挂载**（没有这一步，包在 node_modules 里也不会被加载）：

   ```yaml
   - insert:
       - id: dsh-cockpit
         name: "@local/dsh-cockpit"
   ```

4. **重启 DSH**。斜杠菜单马上就是分组形态。

### 校验装没装对

```powershell
# 1. 链接是否指向工程
Get-Item "$HOME\.dsh\profiles\desktop\node_modules\@local\dsh-cockpit" | Select-Object Target
# 2. manifest 是否带 dsh.client 声明（没有它 host 会静默跳过）
Get-Content "$HOME\.dsh\profiles\desktop\node_modules\@local\dsh-cockpit\package.json" -Raw | Select-String 'dsh'
# 3. 运行中的进程启动时间是否晚于安装时间
Get-Process "DeepSeek Harness" | Select-Object Id, StartTime
```

---

## ⚙️ 自定义分组

分组配置存在浏览器的 `localStorage['dsh.cockpit.config']`，形如：

```json
{
  "replaceNative": true,
  "groups": [
    {
      "id": "gstack",
      "name": "⚡ gstack 工作流",
      "priority": 100,
      "icon": "⚡",
      "description": "全流程自动化交付、代码审查、浏览器测试与发布套件",
      "patterns": ["gstack*", "browse", "qa", "ship", "canary", "review", "investigate", "autoplan", "devex-review", "careful", "freeze", "learn", "retro", "spec"]
    },
    {
      "id": "hmos",
      "name": "📱 鸿蒙与 ArkUI",
      "priority": 90,
      "patterns": ["hmos-*", "arkui*", "arkuix*"]
    },
    {
      "id": "media",
      "name": "🎬 漫剧与视听创作",
      "priority": 80,
      "patterns": ["manju-*", "minimax-*", "krea*", "fujimoto-*", "motion-canvas", "remotion-*"]
    }
  ]
}
```

- `patterns` 支持 `前缀*` / `*后缀` / `*包含*` 三种通配；先匹配到的分组胜出，未命中的落到 `other`。
- `priority` 越大越靠前。
- `replaceNative: false` 时保留 DSH 原生的平铺技能列表（默认是接管它，只留分组列表）。

改完后刷新页面即可（`localStorage` 在页面加载时读取）。

---

## 🈶 技能中文介绍

客户端 bundle 是单个文件，运行时没法去读兄弟 JSON，所以中文层是**构建时嵌入** `client.js` 的，有三个文件在管这件事：

| 文件 | 是什么 | 谁改 |
|---|---|---|
| `zh-skills.json` | 从各技能根采集到的 `name` + 英文 `description` | `node scripts/collect-skills.mjs` 自动生成，别手改 |
| `zh-i18n.json` | 人工翻译：`{ "name": { "label": "中文名", "desc": "一句话简介" } }` | **手写，加技能时在这里补** |
| `client.js` 里的 `SKILL_ZH` 块 | 上面两份合并后的成品 | `node scripts/embed-i18n.mjs` 生成 |

日常流程：

```powershell
node scripts/collect-skills.mjs   # 装了新技能后重新采集
# 在 zh-i18n.json 里补中文（缺的会自己列出来）
node scripts/embed-i18n.mjs       # 嵌入 client.js，重启 DSH 生效
node scripts/embed-i18n.mjs --check   # 检查嵌入块是否过期（CI 用）
node --test tests/client.test.mjs     # 15 条协议断言
```

几个刻意定下的规则：

- **`label` 只改显示名，不改标识符。** 菜单行 `无头浏览器` 右边标着 `browse`，按下去插入的仍是 `/browse `。翻译永远不会让菜单插入一个不存在的技能。
- **缺翻译时回退原文。** 没有中文条目的技能照常显示自己的英文简介，不会变成空白。
- **中文键也参与搜索。** 匹配范围是 `name` / 原简介 / 中文名 / 中文简介四者。
- **用户覆盖层**：`localStorage['dsh.cockpit.zh'] = { "browse": { "label": "我的浏览器", "desc": "..." } }`，也接受 `{ label, desc }` 这种更好读的写法；每行覆盖内置值。

---

## 📄 开源许可
MIT License.
