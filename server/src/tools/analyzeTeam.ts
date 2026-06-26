import type { Tool } from './index.js';
import { analyzeTeam } from '../lib/analysis.js';

export const analyzeTeamTool: Tool = {
  name: 'analyze_team',
  description:
    '分析当前队伍的属性克制覆盖，找出短板（如"对岩石系缺乏应对"）。' +
    '无需任何参数——队伍直接从服务器当前状态读取（就是注入的当前队伍块）。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  label: () => '分析队伍克制覆盖',
  validate: () => ({ ok: true, args: {} }),
  execute: async (_args, ctx) => {
    const team = ctx.session.team;
    if (team.length === 0) {
      return {
        summary: '当前队伍为空，无法分析。请先用 update_team 添加宝可梦。',
      };
    }
    const analysis = analyzeTeam(team);
    const weakStr = analysis.weaknesses.length
      ? analysis.weaknesses.map((w) => w.typeZh).join('、')
      : '无明显短板';
    return {
      summary: `已分析 ${team.length} 只队伍。主要短板属性：${weakStr}。（详见克制覆盖卡片）`,
      cards: [{ kind: 'analysis', data: analysis }],
    };
  },
};
