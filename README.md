# DSH Skill Cockpit

**给 DeepSeek Harness 的技能加一层分类和一层记账。**

装了几百个技能之后，`/` 菜单是一条平铺的长列表：不知道有什么、不知道在哪、也记不住刚才用的是哪个。这个插件只做两件事 ——

1. **把 `/` 菜单按组折叠**，能钻进去、能搜、能显示中文名；
2. **在右侧栏放一块「驾驶舱」**，告诉你这个会话正在跑哪个技能、刚才用过哪些、历史上谁用得最多。

两个能力共用同一份分组配置和同一份中文翻译，所以菜单里看到的组和面板里的一致。

| | |
|---|---|
| 宿主 | DeepSeek Harness (DSH)，web / Electron 客户端 |
| 包名 | `dsh-skills-cockpit`（未发布到 npm，用 `npx github:` 装） |
| 测试 | `npm test`，37 条（菜单/面板/设置 31 + 安装器 6） |
| 许可 | MIT |

---

## 它解决的具体问题

| 现状 | 装了之后 |
|---|---|
| `/` 后面是一百多行平铺的技能 | 第一层只有几个分组文件夹（空组自动隐藏），每行带「N 个技能」 |
| 英文名要记、英文简介看不懂 | 行首显示中文名，英文标识保留在右侧；选中插入的仍是英文标识符 |
| 找「鸿蒙那个转场技能」只能靠翻 | 打 `/转场` 直接命中，也能 `/arkui` 搜 |
| 不知道刚才那个技能叫什么，只能往上翻历史 | 右侧栏「本会话用过」，点一下复制命令 |
| 不知道长任务卡在哪一步 | 正在运行的技能会实时出现在面板最上面 |

---

## 一、斜杠菜单（`/`）

打出 `/` 之后：

- **第一层是分组文件夹**，名字以 `/` 结尾（`⚡ gstack 工作流/`），右边标着该组有多少个技能、是不是还有下一层
- **按 `Tab` 或点一下**钻进分组，输入框里的文本变成 `/gstack/`，顶部出现面包屑「技能分类 › ⚡ gstack 工作流」
- **钻进去之后继续打字**就是组内过滤（`/hmos/转弯`）
- **不在分组里直接打字**是全局搜索，命中的技能上面标着它所属的组，同时保留匹配的分组文件夹方便钻进去
- **选中技能**插入 `/技能名 `，和原生行为一致，光标落在空格后面

分组列表不是猜的，是按真实技能目录排的（`gstack` 工作流、鸿蒙与 ArkUI、影视与漫剧、编剧与文学、代码手艺、产品策划、增长运营、通用工具，未命中落到「其他」）。分组规则可以自己改，见下文。

> 关于「接管」：插件默认**接管原生那个 `/` 源**（原地替换它的渲染函数），而不是再注册一个 —— 两个源同时存在会出现两套列表。如果你的 DSH 版本里拿不到那个源，插件会退回「自己注册一个、并踢掉后到的原生源」这条路。两者都有测试覆盖。

---

## 二、驾驶舱面板

位置：右侧栏 → 引导页里的「技能驾驶舱」。它显示的是**技能的实时使用情况**，不是技能目录。

| 段 | 内容 | 数据来源 |
|---|---|---|
| 正在运行 | 此刻还在跑的 skill 调用 | 轨迹快照的 `runningCalls` |
| 本会话用过 | 这个会话里已经用过的，最近用的在上面 | 轨迹快照的 `eventNodes` |
| 全部会话累计 | 跨会话次数排行 | `localStorage['dsh.cockpit.usage']` |

能做的事：

- 头部「本会话 N 个 · 累计 M 个」，右上角 `刷新` 重新读一次轨迹
- 搜索框按名字过滤，中英文都行
- 每行「中文名 + 英文标识符 + 状态 + 次数」，状态可能是「运行中」「上次失败」或「3 分钟前」
- 点任意一行复制 `/技能名 `，剪贴板不可用时回退到 `textarea` 方案，底部弹「已复制」
- 正在跑的技能自己冒出来，不用关掉面板再开
- 右上角 `设置` 进分组编辑器：改名、排序、改归属、导入导出（见 [四、自定义分组](#四自定义分组)）

### 什么算「用过」

只有两条路径计入，其余一律不算：

1. 模型调用了 `skill` 工具（`{ name: "<技能>" }`），包括 `subCalls` 里嵌套的调用，会递归展开
2. 用户**真的发出去**一条以 `/技能名` 开头的消息（只敲在输入框没发送不算）

读文件、跑命令这类工具调用不算技能，不会混进来。

### 两个刻意的行为

- **会话没打开时不假装「你没用过技能」**，而是明说「读不到这个会话的轨迹：它可能还没打开，或本版本没有轨迹服务」。因为 `sessions.binding()` 对未保留的会话返回 `undefined`，这和「用过了但记录为空」是两件事。
- **跨会话累计只按增量记账**：同一个轨迹快照被重放、面板重开、页面刷新，都不会把次数翻倍。记账里存的是「这个会话我见过多少次」。

---

## 三、中文介绍层

技能 frontmatter 基本都是英文。这一层把**显示名和一句话简介**汉化，但不动真正被调用的标识符。

```
无头浏览器  browse                      ← 行首中文名，右侧英文别名
用无头浏览器做 QA 测试和站点自测
```

- 选中后插入的仍然是 `/browse `，**翻译永远不会让菜单插入一个不存在的技能**
- 缺翻译就回退原文，不会变成空白
- 中文参与搜索：`/浏览器`、`/无头` 都能找到 `browse`
- 用户可以用 `localStorage['dsh.cockpit.zh']` 覆盖任意一条

客户端 bundle 是单文件模块，运行时读不到兄弟 JSON，所以中文层是**构建时嵌入** `client.js` 的。三个文件分工：

| 文件 | 是什么 | 谁改 |
|---|---|---|
| `zh-skills.json` | 从各技能根采集到的 `name` + 英文 `description` | `node scripts/collect-skills.mjs` 生成，别手改 |
| `zh-i18n.json` | 人工翻译 `{ "name": { "label": "...", "desc": "..." } }` | **手写，加技能时在这里补** |
| `client.js` 里的 `SKILL_ZH` 块 | 上面两份合并后的成品 | `node scripts/embed-i18n.mjs` 生成 |

日常流程：

```bash
node scripts/collect-skills.mjs        # 装了新技能后重新采集，会列出还缺翻译的
node scripts/embed-i18n.mjs            # 合并 zh-i18n.json 并嵌入 client.js
node scripts/embed-i18n.mjs --check    # 只检查嵌入块是否过期（过期 exit 1）
```

采集脚本默认扫描三个技能根（`~/.dsh/skills`、`~/.claude/skills`，以及脚本里写死的一个项目技能目录）；换机器或换路径时不用改脚本，直接把根目录作为参数传进去：

```bash
node scripts/collect-skills.mjs "D:/my/skills" "D:/other/skills"
```

判断一条是否「仍是英文」用的是拉丁字符数 > 中文字符数，所以「白屏排查 white screen」这种半中半英不会被误判成已翻译。

---

## 四、自定义分组

**推荐在面板里改，不用碰开发者工具。** 右侧栏驾驶舱 → 右上角 `设置`，三块：

| 块 | 能做什么 |
|---|---|
| 分组 · 越靠上越先匹配 | 改名、`↑` `↓` 调顺序、`规则` 展开这个组的通配符、`×` 删组 |
| 技能归属 · 写死的优先于规则 | 搜技能名，用下拉框把它钉到某个组；选「按规则」就交还给通配符 |
| 导入 / 导出 | 把整份配置导出成 JSON 存文件，或把 JSON 粘回来导入；`恢复默认` 一键回到内置八组 |

点 `保存` 后**下一次敲 `/` 就是新分组**，不用刷新也不用重启 —— 斜杠菜单每次展开都读当前配置，而不是启动时的快照。

配置存在浏览器的 `localStorage['dsh.cockpit.config']`，也可以手写：

```json
{
  "replaceNative": true,
  "groups": [
    {
      "id": "gstack",
      "name": "⚡ gstack 工作流",
      "icon": "⚡",
      "priority": 100,
      "description": "全流程自动化交付、代码审查、浏览器测试与发布套件",
      "patterns": ["gstack*", "browse", "qa", "ship", "canary", "review", "investigate"]
    },
    {
      "id": "film",
      "name": "🎬 影视与漫剧",
      "icon": "🎬",
      "priority": 85,
      "description": "影视全流程、漫剧工坊、分镜预演、图像与音视频生成",
      "patterns": ["film-*", "manju-*", "storyboard-*", "shot-*", "scene-*"]
    }
  ],
  "overrides": {
    "browse": "tools"
  }
}
```

| 字段 | 说明 |
|---|---|
| `id` | 分组标识，`other` 保留给未命中的技能，不要占用 |
| `name` | 菜单里显示的名字，一般带 Emoji |
| `icon` | 单独存的图标字符，未填时不影响显示 |
| `priority` | 排序权重，**越大越靠前**；匹配也是按这个顺序先到先得 |
| `description` | 面板/文件夹行的补充说明 |
| `patterns` | 通配符数组：`前缀*`、`*后缀`、`*包含*`、完整名字（不带 `*` 即精确匹配）；`*` 匹配全部 |
| `overrides` | `{技能名: 分组 id}` 的显式指派，**压过所有通配规则**；指向不存在的组时自动忽略 |

- **写死的归属最先算**：`overrides` 命中就用它，其次才按 `priority` 先到先得。所以通用规则要放低优先级。
- **未命中落到「📦 其他实用技能」**，不会丢技能。
- **`replaceNative: false`** 保留 DSH 原生那条平铺列表（默认 `true`，即接管它，只留分组列表）。
- 手改 JSON 后刷新页面生效；在面板里改则保存即生效。

---

## 五、安装

一条命令，装完重启 DSH：

```bash
npx -y github:JueMingObject/dsh-skillcockpit
```

它做四件事，都是 DSH 加载客户端插件必须满足的：

1. 把插件放进 `~/.dsh/plugins/dsh-cockpit`（从 `npx` 缓存复制出来，缓存清掉也不影响）；
2. 在 profile 的 `package.json` 里声明 `"dsh-skills-cockpit": "link:../../plugins/dsh-cockpit"`，下次 `pnpm install` 不会把它清掉；
3. 让 profile 的 `node_modules` 能解析到它（有 pnpm 就跑 pnpm，没有就建 junction，两种都能用）；
4. 在 profile 的 `cordis.patch.yml` 里挂载 `id: dsh-cockpit`（**少了这步，包躺在 `node_modules` 里也不会被加载**）。

然后**完全退出 DSH 再启动**。客户端模块列表只在 host 启动时扫描一次，刷新页面不够。

### 参数

| 参数 | 作用 |
|---|---|
| `--profile <name>` | 装到哪个 profile，默认 `desktop`；`dsh web` 之类默认 `web` |
| `--home <dir>` | DSH home，默认 `$DSH_HOME`，再退到 `~/.dsh` |
| `--dev <路径>` | 改成链接你正在改的那份 checkout（开发用；在仓库里直接跑 `node bin/install.mjs` 也会自动走这条） |
| `--uninstall` | 摘掉 patch 项、依赖和链接（复制出来的插件目录保留，删不删随你） |
| `--dry-run` | 只打印要做什么，一个字节都不改 |
| `--force` | 覆盖已存在的插件目录 / 链接 |

```bash
node bin/install.mjs --dry-run            # 先看它要动什么
node bin/install.mjs --dev .              # 开发：链接当前仓库
node bin/install.mjs --profile web        # 装到 web profile
node bin/install.mjs --uninstall
```

> 发布到 npm 之后还可以 `npx dsh-skills-cockpit`。目前只能走 `github:` 那种写法，因为包名还没发布。

<details>
<summary>不想跑脚本？手动装也行（四步）</summary>

以 `desktop` profile（`%USERPROFILE%\.dsh\profiles\desktop`）为例：

```powershell
# 1. 插件放进 ~/.dsh/plugins（开发期用 junction 指向你的仓库）
New-Item -ItemType Junction -Path "$HOME\.dsh\plugins\dsh-cockpit" -Target "G:\AI\Claude-Workspace\Projects\dsh-cockpit"
```

```json
// 2. profile 的 package.json
"dsh-skills-cockpit": "link:../../plugins/dsh-cockpit"
```

```powershell
# 3. 装一次，让 node_modules 认它
node "G:\AI\Dsh\resources\runtime\pnpm\bin\pnpm.mjs" install
```

```yaml
# 4. profile 的 cordis.patch.yml
- insert:
    - id: dsh-cockpit
      name: "dsh-skills-cockpit"
```

最后重启 DSH。

</details>

### 什么时候要重启，什么时候刷新就行

| 改动 | 生效方式 |
|---|---|
| 新装插件、改 `cordis.patch.yml`、改 `package.json` | **重启 DSH** |
| 只改 `client.js` / 中文层 / 分组默认值 | **刷新页面**（HMR 每 500ms 比对 bundle 的 mtime，变化即推送） |

### 装没装对，三条命令

```powershell
# 1. 链接是否指向工程
Get-Item "$HOME\.dsh\profiles\desktop\node_modules\dsh-skills-cockpit" | Select-Object Target
# 2. manifest 是否带 dsh.client（没有它 host 会静默跳过，不报错）
Select-String 'dsh' "$HOME\.dsh\profiles\desktop\node_modules\dsh-skills-cockpit\package.json"
# 3. 运行中的进程启动时间是否晚于安装时间（早了就说明还没重启）
Get-Process "DeepSeek Harness" | Select-Object Id, StartTime
```

如果菜单没变化，按这个顺序排查：进程启动时间 → `cordis.patch.yml` 有没有 `dsh-cockpit` → `node_modules/dsh-skills-cockpit` 是否存在 → 浏览器控制台有没有 `[dsh-cockpit]` 开头的警告。

---

## 六、开发

```
dsh-cockpit/
├── client.js              客户端 bundle（单文件，唯一产物；菜单 + 面板 + 中文层都在这里）
├── bin/install.mjs        一键安装器：放进 plugins、声明依赖、挂 patch，一次做完
├── lib/index.js           host 侧入口（空 apply，本插件不需要服务端逻辑）
├── scripts/
│   ├── collect-skills.mjs 采集技能目录 → zh-skills.json
│   └── embed-i18n.mjs     合并 zh-i18n.json → 嵌入 client.js 的 SKILL_ZH 块
├── tests/
│   ├── client.test.mjs    24 条：菜单候选、钻取、面包屑、分组、中文、面板三段、记账
│   ├── install.test.mjs   6 条：真进程跑安装器，查复制/依赖/解析/patch/幂等/迁移/卸载
│   └── panel.helper.mjs   迷你 React（useState/useEffect）+ vm 沙箱挂载器
├── zh-skills.json         自动生成
├── zh-i18n.json           人工翻译
└── src/                   ⚠️ 早期 TypeScript 草稿，已被 client.js 取代，别照着它写
```

**唯一事实来源是 `client.js`。** `src/` 里那份是动手前写的类型草稿，其中 `drill` 还写成回调、面板也还没有，与当前实现不一致；没有构建步骤会读它，删掉不影响插件运行。留着只是因为还没确认要清掉。

命令：

```bash
npm test                             # 37 条：菜单/面板/设置 31 条 + 安装器 6 条
node --check client.js               # 语法检查（bundle 不走构建，直接是产物）
node scripts/embed-i18n.mjs --check  # 中文层是否过期
```

测试用 `node:vm` 把 `client.js` 挂到假 `window.__ModuleLoader__` 上，配假 `localStorage`、假 `InputTriggerService`、假 `sessions`/`uiConversation`、假 React 渲染器，所以不依赖真实 DSH 就能验证候选列表和面板输出。**改协议相关代码后必须跑**：很多时候错误不会报错，只是菜单里少一行或插错一段文本。

`tests/install.test.mjs` 走的是真进程：临时造一个 DSH home，跑真正的 `bin/install.mjs`，然后检查复制出来的文件、`package.json` 依赖、`node_modules` 解析、`cordis.patch.yml` 的插入位置、重复安装是否幂等、旧包名是否被迁移、`--uninstall` 是否把三样都摘干净。改安装器之后必须跑 —— 写错一行 patch，插件就是静默不加载。

### 改之前要知道的协议事实（都是踩过的坑）

- `InputTriggerCandidate.drill` 是 **boolean**，不是回调。传函数会被当 truthy，然后菜单会让你选一个「钻取动作」而没有任何下钻。
- 钻取不是返回新候选，而是把输入框里的**整段 token 替换掉**：`onPick` 返回 `{ text: '/gstack/', continue: true }`，controller 自己会重新请求候选（此时 `request.drilled === true`）。
- 面包屑由 `header(session, request)` 返回，只在 `request.drilled` 时给；根节点那一条的 `value` 也要是同一份 payload，否则点面包屑回不去。
- 菜单行的主文本是 `item.label ?? item.name`；`label` 和 `name` 不同时，`name` 会作为别名小字显示 —— 中文层正是靠这个机制工作的。
- 右侧栏 tab 的 `priority` 是枚举 `'extension' | 'builtin' | 'fallback'`，**不是数字**；正文注册的 `key` 必须等于 tab 定义的 `id`，否则那块显示「没有视图能打开这个」。
- 会话数据要用 `ctx.get('sessions')` / `ctx.get('uiConversation')` 取，再 `sessions.binding(id)` → `uiConversation.binding(binding).target('trajectory')`；`binding()` 对未打开的会话返回 `undefined`，必须当正常分支处理。
- 面板注册走 `ctx.inject(['sidebarRightTabs','slots'], …)` 而不是模块级 `inject` 列表：没有侧边栏的构建里，斜杠菜单照样能用。
- `tests/panel.helper.mjs` 的假 React 必须在 effect 里 setState 之后**自动重渲染**。否则「首屏由 effect 填充」的面板永远测出一棵空树，看起来像组件有问题。
- 设置视图是面板的**子组件**，假 React 还要真的调用子函数组件（`expand()`），否则断言只能看到一层 descriptor。写完记得给行加可区分的 class（`dsh-cockpit-grouprow` / `dsh-cockpit-assignrow`），并注意 **`input` 的值是 `props.value`，不在 `textOf()` 里**。
- 假 `localStorage` 要带 `removeItem`。漏了它，`clearCockpitConfig()` 会掉进自己的 `try/catch`，「恢复默认」静默变成空操作 —— 测试会指着组件喊错。

---

## 七、现在还没做

按诚实原则列清楚，别按已实现理解：

- **MCP 工具列表、后台进程监控、产出素材卡片**（右侧栏的其他块）
- **面板里直接触发技能**：现在只复制命令，粘到输入框才会跑
- **分组配置的界面**：现在只能手改 `localStorage`，没有设置面板
- **发布到 npm registry**：包已经按可发布形态准备好（`private` 已去掉，补了 `files`/`bin`/`LICENSE`），只差账号登录后 `npm publish`；在那之前用 `npx github:` 装

---

## 八、许可

MIT License.
