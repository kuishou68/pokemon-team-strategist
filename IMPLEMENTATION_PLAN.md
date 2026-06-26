# 宝可梦队伍策略师 — 实施方案（题目 B）

> 状态：**待确认**。确认后开始实施。
> 创建日期：2026-06-26
> 复用题目 A（smart-recipe-assistant）的架构经验，沿用同一套 harness 设计。

---

## 1. 目标与范围

基于免费公开 API（PokeAPI），构建一个 **宝可梦队伍策略师**：
用户描述对战需求或偏好，AI Agent 查询宝可梦数据后推荐最佳队伍组合，支持多轮调整队伍。

### 必做项（题目要求）
- [ ] 后端 AI Agent：用 **OpenRouter** 调 LLM，**≥3 个 Tool**，Agent 自主决定调用，支持多轮对话（如"换掉队伍里的水系，推荐一个电系"）。
- [ ] 前端 Web：Chat 对话界面 + 宝可梦卡片**结构化展示**（官方图片、属性标签、种族值），不显示原始 JSON。

### 已确认要做的加分项
- [ ] **队伍组合视图**（6 只宝可梦概览）
- [ ] **种族值雷达图/柱状图**
- [ ] **属性克制覆盖分析**（"你的队伍对岩石系缺乏应对"）
- [ ] **进化链展示**
- [ ] **对战模拟建议**（"对手派出喷火龙，你应该换上谁？"）★ 重新纳入：最体现策略师定位，静态计算性价比高
- [ ] **精美加分**（宝可梦游戏风，见 §6.5）
- [ ] 基础错误处理与优雅降级
- [ ] 流式输出（SSE）+ Tool 调用链可视化（沿用题目 A 经验，默认带上）

### 加分项设计总原则（来自题目 A 教训）
| A 的教训 | 在 B 加分项上的应用 |
|---|---|
| 功能不能隐藏 | 加分项做成**常驻 Dashboard 面板**，不塞进聊天流（见 §6.0 双栏布局）|
| 正确性靠代码不靠模型 | 克制/对战计算全用静态 typechart，模型只讲解 |
| Tool + 面板双通道 | 每个加分项既是可对话 Tool，又是常驻视图 |
| 时间轴推演 | view 由 `team` SSE 事件驱动，数据到位才渲染 |
| 静态词典优先 | 宝可梦名/属性/进化条件用静态词典，零延迟 |
| 浏览器实测 | 每个图表/动画真实渲染验证 |

---

## 2. 技术栈（已确认：完全复用题目 A）

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express + TypeScript，`openai` SDK 走 OpenRouter |
| 流式 | Server-Sent Events (SSE)，决策轮非流式 / 终答轮流式 |
| 前端 | React + Vite + TypeScript + Tailwind CSS |
| 图表 | 种族值雷达图/柱状图：轻量自绘 SVG（不引重型图表库，避免体积膨胀）|
| 会话 | 后端有状态内存 Map + TTL/LRU + mutex（沿用题目 A）|
| 测试 | Vitest + @testing-library/react |
| 配置 | `.env`（`OPENROUTER_API_KEY` 由用户提供）|

> 直接复用题目 A 经验，避免已踩过的坑：决策轮非流式、`res.on('close')`、cookie 在 writeHead 之前、CSS Grid `items-start`、稳定 key、翻译时序等。

---

## 3. 队伍状态管理（题目 B 核心，v2 演进：服务端结构化）

> 演进说明：初版"纯对话历史维护队伍"对小模型不够 robust（换队员是 5 步状态变更链，小模型必崩）。改为服务端结构化状态 + 每轮注入。

**服务端结构化队伍 + 每轮注入上下文 + 显式增删工具**：
1. session 存 `team: PokemonSnapshot[]`（≤6，含 `{id, name, nameZh, types[], stats}`）。
2. **每轮把当前队伍注入上下文**（ephemeral 系统消息，按 state 重建，标好每只属性）→ 模型永远读真相、不靠自己记忆（消除 F5 多轮丢状态）。
3. 显式队伍变更工具（代码改 state）：`add_to_team` / `remove_from_team` / `replace_team_member`（高层一步替换，消除 F4 复合编排）。
4. 变更后重算 → emit `team` 事件 → 前端队伍视图更新 + 下轮重新注入。
5. **刷新恢复**：队伍是服务端权威 → `GET /api/team`（按 session cookie）让前端重建；聊天历史走 localStorage。

**一致性规则（评审 C1/C2/R2 裁决）**：
- **单一数据源**：`session.team` 是唯一真相，注入块 / `team` 事件 / `GET /api/team` 三者都从它派生（评审 s2）。
- **队伍真相只看注入块**：每轮注入用醒目分隔 `=== 当前队伍（以此为准）===`，system prompt 声明"以当前队伍块为准，忽略历史里旧队伍描述"。
- **注入块永不持久化（评审 R2）**：注入块仅在当轮请求拼接，**不写入 session.messages**；session 只存真实 user/assistant/tool 消息 + 结构化 team state。避免多轮累积矛盾队伍块。
- 历史 tool 消息只存**动作摘要**（"已将皮卡丘加入队伍"），不重述完整队伍。
- **team 事件时序**：每轮工具全部结束后统一 emit 一次最终快照；**本轮无队伍变更则跳过**（评审 s1）。
- 队伍变更合并为 `update_team(action)`（M1）：description 写清每个 action 的必填参数 + 例子，validate **按 action 分支校验**，缺参回结构化 error 让模型补（评审 R1）；server 端**先确认宝可梦存在**再入队（防加入幻觉宝可梦，评审 s4）；处理重复/空/满 6 边界。
- `analyze_team`/`recommend_switch` 不接受队伍参数，直读 server state（M2）。

> 把"记忆+识别+编排"难度从模型转移到代码，小模型也能稳定完成"换掉水系换电系"。详见 §5.7 小模型兼容。

---

## 4. 目录结构（复用题目 A 骨架）

```
pokemon-team-strategist/
├── IMPLEMENTATION_PLAN.md
├── 关键问题与决策.md
├── README.md
├── package.json / .env.example / .gitignore
├── shared/
│   └── types.ts                  # SSE 事件 union + 领域类型（Pokemon/Type/Move/Team）
├── server/
│   ├── src/
│   │   ├── index.ts              # Express 入口 + 直连数据端点
│   │   ├── routes/chat.ts        # /api/chat SSE 适配
│   │   ├── agent.ts              # function-calling 主循环（注入式 emit）
│   │   ├── session.ts            # 会话存储（TTL/LRU/mutex）
│   │   ├── llm.ts                # OpenRouter 客户端 + normalizeAssistant
│   │   ├── logger.ts
│   │   ├── tools/
│   │   │   ├── index.ts          # 统一 Tool 接口注册表
│   │   │   ├── searchPokemon.ts  # search_pokemon
│   │   │   ├── getTypeMatchups.ts# get_type_matchups
│   │   │   ├── getMoveDetail.ts  # get_move_detail
│   │   │   ├── getEvolutionChain.ts # get_evolution_chain（进化链加分，支持分支）
│   │   │   ├── analyzeTeam.ts    # analyze_team（克制覆盖分析加分）
│   │   │   └── recommendSwitch.ts # recommend_switch（对战换人建议加分）
│   │   ├── services/
│   │   │   └── pokeapi.ts        # PokeAPI 封装 + 规范化 + 缓存
│   │   └── lib/
│   │       ├── typechart.ts      # 属性克制矩阵（静态，18×18，零 API 调用）
│   │       ├── aliases.ts        # 中英宝可梦名/属性名词典
│   │       └── cache.ts          # 上游 GET 缓存（TTL）
│   └── __tests__/
└── web/
    └── src/
        ├── api/chat.ts           # fetch + ReadableStream SSE
        ├── useChat.ts            # 状态管理 + localStorage 持久化
        ├── components/
        │   ├── ChatWindow.tsx
        │   ├── MessageBubble.tsx
        │   ├── PokemonCard.tsx   # 卡片：官方图/属性标签/种族值雷达图
        │   ├── StatRadar.tsx     # 种族值雷达图（自绘 SVG）
        │   ├── Dashboard.tsx     # 右栏常驻面板容器（队伍+克制+对战）
        │   ├── TeamView.tsx      # 6 只队伍概览（加分，空态精灵球槽）
        │   ├── TypeCoverage.tsx  # 属性克制覆盖分析（加分，双视图）
        │   ├── BattleHelper.tsx  # 对战换人建议（加分，输入对手→推荐）
        │   ├── EvolutionChain.tsx# 进化链展示（加分，支持分支树状）
        │   ├── TypeBadge.tsx     # 属性标签（带配色）
        │   ├── AudioToggle.tsx   # 右上角喇叭开关（chiptune BGM）
        │   └── ToolTrace.tsx     # 工具调用链可视化
        ├── hooks/
        │   └── useAudio.ts       # BGM/音效播放 + 静音偏好（localStorage）
        ├── theme/
        │   └── pokemon.css       # 像素字体 + 对话框 + 游戏风样式
        └── types.ts
    └── public/
        └── audio/                # CC0 chiptune BGM + 音效（README 标注许可证）
```

---

## 5. 后端设计

### 5.1 Tool 定义（≥3，实际 5 个）

| Tool | 职责 | 入参 | PokeAPI |
|---|---|---|---|
| `search_pokemon` | 按名/ID 查宝可梦基础信息（种族值/属性/图片/技能）| `query` | `/pokemon/{id_or_name}` |
| `get_type_matchups` | 查属性克制关系（含双属性叠加计算）| `types[]` | `/type/{name}`（或静态 typechart）|
| `get_move_detail` | 查招式详情（威力/命中/PP/属性/伤害类型）| `move` | `/move/{id_or_name}` |
| `get_evolution_chain`（加分）| 查进化链（**支持分支进化**）| `pokemon` | `/pokemon-species` → `/evolution-chain/{id}` |
| `analyze_team`（加分）| 分析队伍属性克制覆盖、找短板 | **无参（直接读 server team state）** | 组合 typechart 计算（本地）|
| `update_team`（队伍变更）| 增/删/替换队员（合并 add/remove/replace，降工具数）| `action`("add"\|"remove"\|"replace"), `pokemon?`, `target?` | 改 server team state |
| `recommend_switch`（加分）| 对战换人建议：给定对手，评分推荐队员 | `opponent`（**队伍自动读 server state，不传**）| typechart + 种族值 + 速度评分（本地）|

**`recommend_switch` 评分逻辑（代码计算，防模型恐慌换人）**：
- 对每只队员算 3 项：① 防御（对手属性打我的倍率，越低越好）② 进攻（我属性克对手吗）③ 速度（谁先手）
- 加权排序（如 属性克制 60% / 速度 20% / 种族值 20%，权重透明可调）→ 返回推荐 + 理由
- 模型只负责把代码结果讲成自然语言，不自己判断克制（PokéLLMon 失败模式：被属性诈骗、恐慌换人）

**`get_evolution_chain` 分支进化坑（⚠️ B 版的"filter.php 字段差异"）**：
- 伊布等宝可梦有多分支进化（性别/道具/亲密度/地点条件）
- 进化链是**树结构非线性链**，规范化与前端布局都必须支持分支，不能假设单线

- 统一 `Tool` 接口（name/description/schema/validate/execute/toModelSummary/toCards），`tools/index.ts` 单一注册表。
- **属性克制用静态 typechart（18×18 矩阵）**：克制关系是固定规则，不必每次调 `/type` API，零延迟、零失败。`get_type_matchups` 优先查静态表。

### 5.2 数据规范化（关键点）
- **官方中文（实测确认，与题目 A 根本不同）**：PokeAPI 自带 `zh-hans` 官方中文——
  - 宝可梦名：`species.names` lang=`zh-hans`（皮卡丘）
  - 属性名：`type.names`（火）
  - 招式名：`move.names`（火焰拳）
  - 图鉴描述：`species.flavor_text_entries` lang=`zh-hans`
  - **翻译策略**：规范化时直接提取 `zh-hans` 字段，**不做 LLM 翻译**（质量更高、零延迟、零闪烁）。题目 A 的翻译模块在 B 不需要。静态词典只保留"用户中文输入→英文 query"的反向映射（皮卡丘→pikachu）。
- **种族值**：从 `stats[]` 提取 HP/攻击/防御/特攻/特防/速度 → `{ hp, attack, defense, spAtk, spDef, speed }`。
- **属性**：`types[]` → `["fire","flying"]` + 中文 `["火","飞行"]`，前端 TypeBadge 配色。
- **图片（⚠️ 中国网络）**：立绘 URL 是 `raw.githubusercontent.com`，国内常被墙/极慢。
  - 对策：后端**图片代理** `GET /api/sprite/:id`（转发 + 缓存），前端统一走代理；加载失败 fallback 精灵球占位图。
- **双属性克制叠加**：火/飞 对 岩石 = 0.5×2 = 1×（相乘）；**必须处理 0× 免疫**（普通×幽灵、地面×飞行），0× 叠加会整体归零，typechart 模块专门处理。

### 5.3 Agent 主循环（复用题目 A）
- 注入式 `emit`、决策非流式/终答流式、`stopWhen=stepCountIs(6)`、AbortSignal、回灌紧凑摘要（含 id）。
- system prompt 要点：信息必来自工具不编造、参数用英文、多轮记住当前队伍（≤6）、复合请求分步、回复用用户语言、宝可梦名/属性直接中文输出。

### 5.4 SSE 事件协议（复用 + 新增 team）
```
thinking / step_start / tool_input / tool_output / cards / token / notice / done / error
+ team       data: { pokemon: [...6 只快照] }   # 队伍视图同步（新增）
+ : ping 心跳
```

### 5.5 直连数据端点（卡片点击/详情用，不走 LLM）
- `GET /api/pokemon/:idOrName` → 规范化宝可梦详情（含官方中文）
- `GET /api/evolution/:pokemon` → 进化链（支持分支）
- `GET /api/team` → 当前 session 队伍（刷新恢复用）
- `GET /api/sprite/:id` → **图片代理**（转发 raw.githubusercontent + **磁盘/内存缓存图片**，首次慢之后快；评审 M3：不缓存等于没解决，缓存是关键）

### 5.6 错误处理、安全与降级
- 上游超时 8s + 1 次重试；空结果给 hint 不报错；缺 key 启动即报错。
- `res.on('close')` 取消传导；客户端断开 abort LLM 流与上游 fetch。
- N+1 防护：`cache.ts` 强缓存上游 GET（PokeAPI 要求本地缓存、勿高频轰炸）。
- **图片代理 SSRF 收口（评审 v1）**：只代理固定 PokeAPI sprite 域名，`:id` 严格校验为数字，绝不转发任意 URL；限制并发。
- **降级（评审 v3）**：PokeAPI 5xx/超时 → 全局缓存命中返回旧数据；**静态 typechart 保证克制/对战功能即使 PokeAPI 全挂仍可用**（天然降级）。
- **复用 A 机制（评审 v2/v4/v5/v6）**：输入长度上限 + 单 session 轮数上限 + 单 session mutex（队伍变更也在锁内）+ .env gitignore + prompt 注入防护 + 提交不带 Claude 署名。

### 5.7 小模型兼容（沿用题目 A 四层防御 + B 特化）
| 层 | B 的特化 |
|---|---|
| 1. Prompt/Schema | 工具按"查询/队伍/对战"分组说明；每轮注入当前队伍消除记忆负担 |
| 2. 参数校验 | 宝可梦名静态中英词典 + PokeAPI 名单模糊匹配（皮卡丘→pikachu，拼错纠正）；**词典未命中 fallback**（评审 m2）：让模型按 prompt 直接输出英文名，或交 PokeAPI 直查，不强依赖词典全覆盖 |
| 3. 工具健壮性 | 空结果 hint、超时重试、满 6 只友好拒绝 |
| 4. 错误回喂 + 高层工具 | `replace_team_member`/`recommend_switch` 把多步链压成单次；克制/换人评分全代码算（防恐慌换人）|
- 三招 B 特有：每轮注入队伍（消除 F5）+ 高层工具（消除 F4）+ 静态 typechart 代码评分（消除克制幻觉）。

### 5.8 typechart 正确性（关键基础设施）
- 用**第 6 世代后现代克制表**（妖精系、钢/恶调整），README 标注世代。
- **数据来源（评审 m1/s3）**：以**经核对的静态种子为主**（启动不依赖网络、不变慢），PokeAPI `/type` 仅作可选刷新校验；单测校验标志性 matchup（火→草 2×、水→火 2×、普通→幽灵 0×、电→地面 0×）。
- **必须处理 0× 免疫**（普通×幽灵、地面×飞行、电×地面…），双属性叠加 0× 整体归零。
- 18×18 矩阵**单元测试全覆盖**——一格错则所有克制/对战建议全错，是正确性基石。

### 5.10 进化链分支布局（评审 M4）
- 进化链是树（伊布 8 分支）。前端 `EvolutionChain.tsx` 布局方案：
  - 线性链（多数）：横向箭头 + 进化条件。
  - 分支：**第一阶段在左，多个进化去向纵向堆叠在右**（树形），每条标进化条件。
  - 兜底：分支过多时降级为"进化去向列表"（牺牲视觉换稳定）。

### 5.11 性能策略（评审第三轮）
- **全局缓存宝可梦数据**：宝可梦/属性/招式数据不变，全局 LRU 缓存（非 per-session），跨会话复用（评审 u3）。
- **并发取数**：搜一只要 `/pokemon` + `/pokemon-species`（取中文名），用 `Promise.all` 并发不串行（评审 u1）。
- **recommend_switch**：队伍 6 只已在 session.team（含 stats），评分纯本地；**只差对手 1 次上游调用**（走 cache）（评审 T1）。
- **注入块精简**（评审 T2）：每轮注入只含 名+属性+槽位，不含完整种族值/技能（完整数据在 server state，工具按需取），控制每轮 token。
- **进化链懒加载**（评审 T3）：先展示 名+箭头+进化条件（一次 evolution-chain 调用），点击某形态才取详情，避免全链 N+1。
- flavor_text 取固定版本最新一条（评审 u4）；评分权重集中为代码常量便于调优（评审 u5）。

### 5.9 recommend_switch 诚实标注
- 仅用 种族值+属性+速度，**无 EV/IV/性格/道具/特性**（如飘浮免疫地面）。
- 文案明确"基于属性和种族值的快速参考"，不号称精确对战模拟，管理用户预期。

### 5.12 招式卡字段（评审 x2）
- `get_move_detail` 卡片展示：中文名 + 威力/命中/PP + 属性(TypeBadge) + **伤害类型(物理/特殊/变化)**。

### 5.13 测试策略（评审第五轮）
- **typechart 单测**（正确性基石）：维度 18×18、对称抽查、0× 免疫、双属性叠加（火/飞×岩=1×）。
- **recommend_switch 评分单测**：克制对手高分、速度劣势扣分、免疫场景。
- **update_team 状态机单测**：add/remove/replace、满 6 拒绝、空队伍、重复、幻觉宝可梦拒绝。
- **agent 集成测试**（桩 LLM + 内存 sink）：多轮"换水系换电系"能读注入队伍 + 调 update_team(replace)。
- **前端组件测试**：PokemonCard / StatRadar SVG / TeamView 空态 / TypeCoverage 短板 / EvolutionChain 分支。

---

## 6. 前端设计

### 6.0 Dashboard + Chat 双栏布局（核心架构，杜绝"隐藏功能"）

> 题目 A 的最大教训：加分功能塞进聊天流会被刷走、不可发现。B 用**结构性解法**——常驻 Dashboard。

```
┌─────────────────────┬──────────────────┐
│   Chat 对话区        │  🎒 当前队伍 (6)  │  ← 常驻 Dashboard
│   (流式 + 卡片)      │  [6 槽位/空精灵球] │     永远可见
│                     │  🛡️ 克制覆盖分析   │
│                     │  [短板高亮/双视图] │
│                     │  ⚔️ 对战助手       │
│                     │  [输入对手→建议]   │
└─────────────────────┴──────────────────┘
```
- 移动端：Dashboard 收起为可展开抽屉/标签页。
- 所有加分项天然常驻可见，对话进行中随时可用。
- 每个面板既能被对话触发（Tool），也能在面板内直接操作（操作转为 chat 消息发给 Agent，保持 Agent 为真相源）。

### 6.1 各组件设计要点

- **Chat 布局** + fetch/ReadableStream SSE + 流式气泡 + 历史 localStorage 持久化。
- **PokemonCard**：官方立绘、中英双名、属性标签（TypeBadge 按官方配色）、种族值雷达图（StatRadar 自绘 SVG）。
- **TeamView**（加分）：常驻顶部/侧边，展示当前 6 只队伍概览，由 `team` 事件驱动。
- **TypeCoverage**（加分）：队伍对 18 属性的攻防覆盖热力，标出短板（"对岩石系缺乏应对"）。
- **EvolutionChain**（加分）：进化路线横向展示，箭头 + 进化条件。
- **StatRadar**（加分）：6 维种族值雷达图，自绘 SVG。
- **ToolTrace**：复用题目 A 重设计版（人话标签 + 时间线 + 父子层级 + 状态动效）。
- **快捷入口**：常驻 FilterBar 风格——按属性/对战场景的快捷查询（如"推荐一个火系输出""分析我队伍短板"）。

---

## 6.5 宝可梦游戏风主题（视觉 + 音频）

> 借鉴宝可梦游戏的**设计语言**，不直接搬运任何官方素材（规避版权）。

### 视觉（全面游戏风，已确认）
| 元素 | 做法 |
|---|---|
| 字体 | 免费像素字体（Press Start 2P / Pokemon GB 风格），中文用圆体兜底 |
| 对话框 | 经典蓝白描边对话框（圆角粗边 + 阴影），用于消息气泡 |
| 配色 | 宝可梦红/蓝主题 + 18 属性官方配色（TypeBadge）|
| 精灵图 | PokeAPI **pixel sprites** 做小图标（合法），official-artwork 做大图 |
| 种族值 | 仿游戏 HP 绿条样式做柱状 + 雷达图 |
| 按钮/卡片 | 圆角 + 厚边框 + 轻投影，模拟游戏 UI 质感 |
| 属性标签 | 仿游戏内属性图标样式 |

### 音频（免版税 chiptune，默认静音手动开启，已确认）
- **合规红线**：绝不使用宝可梦原版 BGM/音效（侵权，开源风险大）。
- 用 **CC0/免版税 8-bit chiptune** 背景音乐（风格相近，合规）。
- 轻量交互音效（点击、宝可梦"出场"提示音）用 CC0 音源。
- **默认静音**，右上角喇叭开关用户手动开启（避免自动播放，合规 + 体验）。
- 音频文件放 `web/public/audio/`，README 标注来源与许可证。
- 实现：`useAudio` hook 管理播放/静音状态 + localStorage 记忆偏好。

## 7. 复用题目 A 的经验教训（避免重踩）

| 经验 | 应用 |
|---|---|
| 决策轮非流式 | 规避流式 tool_call 分片格式问题 |
| `res.on('close')` 而非 `req.on('close')` | 避免 POST 刚连接就误判断开 |
| cookie 在 writeHead 之前 | 避免 ERR_HTTP_HEADERS_SENT |
| CSS Grid `items-start` | 队伍/卡片网格避免拉伸空白 |
| 稳定 key（用 pokemon id）| 避免 React 组件状态错位 |
| 翻译在 emit(cards) 之前 | 卡片首次出现即中文，无闪烁 |
| 静态词典优先于 LLM 翻译 | 宝可梦名/属性名静态词典，零延迟 |
| 维度纠正（A 的 category/area）| 宝可梦名/属性名校验 + 别名兜底 |

---

## 8. 实施里程碑

0. 契约先行：`shared/types.ts`（SSE union + Pokemon/Type/Move/Team）+ 会话骨架。
1. 脚手架：根 package.json + server/web 初始化 + Tailwind + Vitest + .env.example。
2. 数据服务层：pokeapi.ts 封装 + 规范化 + 静态 typechart + 纯函数单测。
3. 工具层：5 个 tool + 注册表 + validate + 单测。
4. LLM + Agent 循环：OpenRouter + emit 解耦 + 决策非流式/终答流式 + stopWhen + abort。
5. 传输层 + 后端联调：routes/chat.ts SSE + team 事件 + curl 验证。
6. 前端聊天 UI：布局 + SSE 接入 + 流式气泡 + 历史持久化。
7. PokemonCard + 属性标签 + 种族值雷达图 + ToolTrace。
8. 加分：队伍视图 + 克制覆盖分析 + 进化链。
9. 错误处理/取消/降级 + 翻译 + 样式精修 + README。
10. **端到端验证（含浏览器实测）**：搜索/克制/招式/队伍调整/进化链/异常路径 + 时间轴推演 + 可发现性检查。

---

## 9. 验收清单
- [ ] 自然语言输入 → Agent 自主选对工具并多轮对话。
- [ ] ≥3 个 Tool 实际可用（search_pokemon/get_type_matchups/get_move_detail）。
- [ ] 宝可梦卡片含官方图+属性标签+种族值，无裸 JSON。
- [ ] "换掉队伍里的水系，推荐一个电系" 多轮调整生效。
- [ ] 队伍组合视图（6 只）可见。
- [ ] 种族值雷达图渲染正确。
- [ ] 属性克制覆盖分析能指出短板。
- [ ] 进化链展示。
- [ ] SSE 流式 + Tool 调用链可视化。
- [ ] **浏览器实测**：每个加分功能冷启动可发现、对话中途可用、无渲染异常。

### 9.1 健壮性迷你 eval（刁难 prompt）
| 测试 | 期望 |
|---|---|
| "皮卡丘怎么样"（中文名）| 别名/英文参数 → search_pokemon(pikachu)，出卡片 |
| "火克什么"（属性克制）| get_type_matchups，列出火系克制关系 |
| "推荐一支均衡队伍" | 多次 search_pokemon 组成 6 只 + team 视图 |
| "换掉水系换电系"（多轮）| 读当前队伍，替换对应位置 |
| "我的队伍怕什么"（克制分析）| analyze_team 找短板 |
| "asdfqwer"（不存在）| 友好提示不崩 |

---

## 10. 评审裁决记录（规划者视角）

第一轮评审（`方案评审意见.md`）逐条裁决：

| 评审项 | 裁决 | 处理 |
|---|---|---|
| C1 注入 vs 历史一致性 | ✅ 采纳 | §3：队伍真相只看注入块（醒目分隔 + prompt 声明），历史只存动作摘要 |
| C2 team 事件时序 | ✅ 采纳 | §3：每轮工具全部结束后统一 emit 一次最终快照 |
| M1 工具数量膨胀 | ✅ 采纳 | add/remove/replace 合并为 `update_team(action)` |
| M2 analyze/recommend 传队伍 | ✅ 采纳 | 两工具不接受队伍参数，直接读 server state |
| M3 图片代理缓存 | ✅ 采纳 | §5.5：代理必须磁盘/内存缓存图片 |
| M4 进化链分支布局 | ✅ 采纳 | §5.10：树形纵向堆叠 + 过多时降级列表 |
| m1 typechart 数据源 | ✅ 采纳 | §5.8：PokeAPI 生成或核对种子 + 标志性 matchup 单测 |
| m2 反向词典覆盖 | ✅ 采纳 | §5.7：未命中 fallback 模型输出英文/PokeAPI 直查 |
| m3 窄屏断点 | 🔧 实施时定 | Dashboard 折叠抽屉 |
| m4 对手查询缓存 | ✅ 采纳 | recommend_switch 查对手走 cache |
| m5 队伍边界 | ✅ 采纳 | 重复/空/满 6 的处理写进 update_team |
| m6 音频文件 | 🔧 实施时 | 占位 + 接入逻辑或音源链接 |

**工具最终数量**：search_pokemon / get_type_matchups / get_move_detail / get_evolution_chain / analyze_team / recommend_switch / update_team = **7 个**（队伍三动作合一）。

**第二轮裁决**（v2 复审，见 `方案评审意见.md` 第二轮）：
| 项 | 裁决 | 处理 |
|---|---|---|
| R1 update_team 条件必填 | ✅ | description 写清 + validate 按 action 分支 + 缺参回错 |
| R2 注入块不持久化 | ✅ | §3：注入块仅当轮拼接，不写 session.messages |
| s1 无变更跳过 team 事件 | ✅ | §3：本轮无队伍变更则跳过 emit |
| s2 单一数据源 | ✅ | §3：session.team 为唯一真相，三处派生 |
| s3 typechart 静态种子为主 | ✅ | §5.8：静态种子主，PokeAPI 可选刷新 |
| s4 入队先确认存在 | ✅ | §3：server 先确认宝可梦存在再入队 |

**第三~七轮裁决**（见 `方案评审意见.md`）：
| 轮 | 焦点 | 关键处理 |
|---|---|---|
| 三 | 性能/规模 | §5.11：全局缓存、并发取数、注入块精简、进化链懒加载 |
| 四 | 安全/降级 | §5.6：图片代理 SSRF 收口、静态 typechart 天然降级、复用 A 安全机制 |
| 五 | 测试策略 | §5.13：typechart/评分/状态机/agent 集成/前端组件测试 |
| 六 | 完整性 critic | §5.12：补招式卡伤害类型字段；冷门宝可梦中文 fallback |
| 七 | 收敛判断 | 评价者签署通过，无阻断项 |

**收敛状态（7 轮）**：自第二轮起无 Critical/Major（三四轮为性能/安全优化，五六轮为测试与补漏）。评价者第七轮**签署通过**，明确"继续即 gold-plating"。核心架构敲定，**实施就绪**。

### 冻结的非目标
完整伤害公式对战模拟、EV/IV/特性计算、鉴权多租户、分布式会话、对战实时联机、宝可梦全图鉴离线库。

---

## 11. 待你确认
- 技术栈、Dashboard 双栏、服务端队伍状态、7 工具、加分范围（含对战模拟）是否 OK？
- 默认模型沿用 `openai/gpt-4o-mini`？
- 确认后可继续评审迭代或进入 /plan 审批 + 编码。
