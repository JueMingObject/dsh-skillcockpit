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
   - 支持用户通过 `~/.dsh/cockpit.json` 或在界面中自定义组名、图标（Emoji）、排序权重与正则/通配符匹配规则。
3. **📊 驾驶舱面板 (Cockpit Panel)**
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

## 📄 开源许可
MIT License.
