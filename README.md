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

### 方式一：符号链接（推荐开发/日常使用）
将本仓库软链至 DSH 插件目录：
```powershell
New-Item -ItemType SymbolicLink -Path "$HOME\.dsh\plugins\dsh-cockpit" -Target "G:\AI\Claude-Workspace\Projects\dsh-cockpit"
```

### 方式二：手动放入
将构建产物复制到 `~/.dsh/plugins/dsh-cockpit/` 即可。

---

## ⚙️ 自定义配置 (`~/.dsh/cockpit.json`)

```json5
{
  "groups": [
    {
      "id": "gstack",
      "name": "⚡ gstack 工作流全家桶",
      "priority": 100,
      "patterns": ["gstack*", "browse", "qa*", "ship", "canary", "review", "investigate", "autoplan", "devex-review", "careful", "freeze*", "learn", "retro", "spec"]
    },
    {
      "id": "hmos",
      "name": "📱 鸿蒙与 ArkUI",
      "priority": 90,
      "patterns": ["hmos-*", "arkui*"]
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

---

## 📄 开源许可
MIT License.
