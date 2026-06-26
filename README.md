# 宝可梦队伍策略师（Pokémon Team Strategist）

基于 PokeAPI 的 AI 队伍策略助手：用自然语言描述对战需求，AI Agent 查询宝可梦数据、组建并多轮优化队伍，提供属性克制覆盖分析、进化链、对战换人建议，全程结构化卡片展示（无裸 JSON），宝可梦游戏风 UI。

> 本项目复用「智能食谱助手（题目 A）」的 harness 架构经验，针对题目 B 特性做了服务端结构化队伍 + 每轮注入、官方中文提取、静态克制表代码评分等设计。详见 `IMPLEMENTATION_PLAN.md`。

## 功能

- **AI Agent（OpenRouter）+ 7 个 Tool**，自主决定调用，支持多轮对话（如「换掉队伍里的水系，推荐一个电系」）。
- **7 个工具**：`search_pokemon` / `get_type_matchups` / `get_move_detail` / `get_evolution_chain` / `analyze_team` / `recommend_switch` / `update_team`。
- **服务端结构化队伍**（`session.team`，单一数据源），每轮以 ephemeral 系统消息注入当前队伍，小模型也能稳定多轮改队。
- **官方中文**：直接提取 PokeAPI 的 `zh-hans` 字段（宝可梦名/属性/招式/图鉴），不做 LLM 翻译，零延迟零闪烁。
- **静态 18×18 克制表**：克制/对战评分全代码计算（含 0× 免疫、双属性叠加），防模型幻觉，PokeAPI 全挂仍可用（天然降级）。
- **常驻 Dashboard 双栏**：左 Chat，右 队伍视图 + 克制覆盖（双视图/短板高亮）+ 对战助手；移动端折叠抽屉。
- **结构化卡片**：宝可梦卡（官方立绘 + 中英双名 + 属性标签 + 种族值雷达图/HP 条）、招式卡、克制卡、进化链（支持分支树）、队伍分析卡、换人建议卡。
- **SSE 流式输出 + 工具调用链可视化**（人话标签 + 时间线 + 状态动效）。
- **图片代理**：`/api/sprite/:id`（SSRF 收口 + 磁盘/内存缓存），解决 raw.githubusercontent 国内访问慢；失败 fallback 精灵球占位。
- **游戏风主题**：像素字体、蓝白描边对话框、红蓝主题、仿游戏 HP 条、精灵球 loading + CC0 chiptune BGM（默认静音，右上角开关）。

<img width="2406" height="1982" alt="ScreenShot_2026-06-26_151258_978" src="https://github.com/user-attachments/assets/9a15019b-2f04-4863-8559-73594477d3c0" />
<img width="3066" height="1976" alt="ScreenShot_2026-06-26_151151_001" src="https://github.com/user-attachments/assets/ee339197-01c8-4c59-82c9-f44293213043" />


## 技术栈

- 后端：Node.js + Express + TypeScript，`openai` SDK 走 OpenRouter，SSE。
- 前端：React + Vite + TypeScript + Tailwind CSS，自绘 SVG 图表。
- 测试：Vitest（+ @testing-library/react）。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 OpenRouter Key：

```bash
cp .env.example .env
# 编辑 .env，填入 OPENROUTER_API_KEY
```

```
OPENROUTER_API_KEY=sk-or-v1-xxxx   # 必填，缺失则后端拒绝启动
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PORT=8788
```

> 后端通过 `dotenv` 读取根目录 `.env`。也可直接在 shell 里 `export OPENROUTER_API_KEY=...`。

### 3. 一键启动开发环境

```bash
npm run dev
```

- 后端：http://localhost:8788
- 前端：http://localhost:5173 （Vite 代理 `/api` → 后端）

打开 http://localhost:5173 即可对话。

### 4. 构建 / 测试

```bash
npm run build   # tsc 编译后端 + vite 构建前端
npm test        # 运行全部单测（server + web，不依赖真实 key）
```

## 试一试（验收场景）

- 「皮卡丘怎么样？」→ 出宝可梦卡片（官方立绘 + 雷达图）
- 「推荐一支均衡的队伍」→ 多次查询组成队伍，右侧队伍视图实时更新
- 「换掉队伍里的水系，换一个电系」→ 读当前队伍并替换对应槽位
- 「我的队伍怕什么？」→ 克制覆盖分析，标出短板
- 「对手派出喷火龙，我该换谁？」→ 对战换人建议（代码评分排序）
- 「伊布的进化链」→ 8 分支进化树
- 右侧「对战助手」输入对手 → 自动转成对话发给 Agent
<img width="750" height="1630" alt="ScreenShot_2026-06-26_151555_408" src="https://github.com/user-attachments/assets/f482148a-0c3f-4e24-ad00-419781e9245f" />
<img width="756" height="1632" alt="ScreenShot_2026-06-26_151459_373" src="https://github.com/user-attachments/assets/f5696c55-eb91-4a4e-8bd5-0765848ca71d" />

## 音频

`web/public/audio/bgm.mp3` 需用户自行放置 **CC0 / 免版税 chiptune** 音源（绝不用原版宝可梦 BGM）。详见 `web/public/audio/README.md`。文件缺失不影响其他功能。

## 致谢与许可证

- 数据来源：[PokéAPI](https://pokeapi.co/)（遵循其使用条款，本地强缓存、不高频请求）。宝可梦名/图鉴/招式/属性的中文为 PokeAPI 提供的官方 `zh-hans` 数据。
- 立绘/精灵图：[PokeAPI/sprites](https://github.com/PokeAPI/sprites)，经本服务代理与缓存。
- 宝可梦为 Nintendo / Game Freak / The Pokémon Company 商标。本项目仅作技术演示，UI 借鉴游戏**设计语言**，不搬运官方素材，不含官方 BGM。

## 设计文档

- `IMPLEMENTATION_PLAN.md` —— 完整实施方案（7 轮评审收敛）。
- `方案评审意见.md` —— 评审记录。
- `关键问题与决策.md` —— Q1-Q10 决策。
- `测试用例.md` —— 手测用例。
- `回归测试报告.md` —— 测试/构建结果。

## typechart 世代说明

属性克制表采用 **第 6 世代后的现代克制表**（含妖精系、钢/恶/幽灵的现代调整），以经核对的静态种子为唯一来源（启动不依赖网络）。单测覆盖 18×18 维度、标志性 matchup、0× 免疫、双属性叠加。
# pokemon-team-strategist
# pokemon-team-strategist
