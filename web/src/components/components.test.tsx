import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Pokemon, PokemonSnapshot, EvolutionChain as Chain, Stats } from '../types';
import { PokemonCard } from './PokemonCard';
import { StatRadar } from './StatRadar';
import { TeamView } from './TeamView';
import { TypeCoverage } from './TypeCoverage';
import { EvolutionChain } from './EvolutionChain';

const STATS: Stats = { hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 };

const CHARIZARD: Pokemon = {
  id: 6,
  name: 'charizard',
  nameZh: '喷火龙',
  types: [
    { name: 'fire', nameZh: '火' },
    { name: 'flying', nameZh: '飞行' },
  ],
  stats: STATS,
  total: 534,
  spriteUrl: '/api/sprite/6',
  pixelSpriteUrl: '/api/sprite/6?pixel=1',
  flavorTextZh: '喷着火焰飞翔。',
  abilities: [{ name: 'blaze', nameZh: '猛火', isHidden: false }],
};

function snap(id: number, name: string, nameZh: string, types: PokemonSnapshot['types']): PokemonSnapshot {
  return {
    id, name, nameZh, types, stats: STATS, total: 534,
    spriteUrl: `/api/sprite/${id}`, pixelSpriteUrl: `/api/sprite/${id}?pixel=1`,
  };
}

describe('PokemonCard', () => {
  it('渲染中英双名 + 双属性标签 + 种族值总和', () => {
    render(<PokemonCard data={CHARIZARD} />);
    expect(screen.getByText('喷火龙')).toBeInTheDocument();
    expect(screen.getByText('charizard')).toBeInTheDocument();
    expect(screen.getByText('火')).toBeInTheDocument();
    expect(screen.getByText('飞行')).toBeInTheDocument();
    expect(screen.getByText(/种族值总和 534/)).toBeInTheDocument();
  });

  it('立绘走代理 url', () => {
    render(<PokemonCard data={CHARIZARD} />);
    const img = screen.getByAltText('喷火龙') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/sprite/6');
  });
});

describe('StatRadar SVG', () => {
  it('渲染 SVG 含 aria 数值', () => {
    const { container } = render(<StatRadar stats={STATS} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toContain('速度100');
    // 六轴 + 数据多边形
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(4);
  });
});

describe('TeamView', () => {
  it('空态显示 6 个精灵球槽', () => {
    render(<TeamView team={[]} onRemove={() => {}} />);
    expect(screen.getAllByTestId('team-slot-empty').length).toBe(6);
  });

  it('有队员时显示填充槽 + 剩余空槽 + 移除按钮回调', () => {
    const team = [snap(6, 'charizard', '喷火龙', CHARIZARD.types)];
    const onRemove = vi.fn();
    render(<TeamView team={team} onRemove={onRemove} />);
    expect(screen.getAllByTestId('team-slot-filled').length).toBe(1);
    expect(screen.getAllByTestId('team-slot-empty').length).toBe(5);
    fireEvent.click(screen.getByLabelText('移除 喷火龙'));
    expect(onRemove).toHaveBeenCalledWith(team[0], 1);
  });
});

describe('TypeCoverage 短板高亮', () => {
  it('全火系队伍标出水系短板', () => {
    const team = [
      snap(4, 'charmander', '小火龙', [{ name: 'fire', nameZh: '火' }]),
      snap(37, 'vulpix', '六尾', [{ name: 'fire', nameZh: '火' }]),
    ];
    render(<TypeCoverage team={team} />);
    expect(screen.getByText(/短板/)).toBeInTheDocument();
    // 水 应作为短板出现（高亮 chip）
    const weakWater = screen.getAllByText('水');
    expect(weakWater.length).toBeGreaterThan(0);
  });

  it('空队伍提示组队', () => {
    render(<TypeCoverage team={[]} />);
    expect(screen.getByText(/队伍为空/)).toBeInTheDocument();
  });
});

describe('EvolutionChain 分支', () => {
  const eevee: Chain = {
    rootId: 133,
    isBranching: true,
    root: {
      id: 133,
      name: 'eevee',
      nameZh: '伊布',
      spriteUrl: '/api/sprite/133',
      evolvesTo: [
        { id: 134, name: 'vaporeon', nameZh: '水伊布', spriteUrl: '/api/sprite/134', condition: '使用 水之石', evolvesTo: [] },
        { id: 135, name: 'jolteon', nameZh: '雷伊布', spriteUrl: '/api/sprite/135', condition: '使用 雷之石', evolvesTo: [] },
      ],
    },
  };

  it('渲染分支去向 + 进化条件', () => {
    render(<EvolutionChain data={eevee} />);
    expect(screen.getByText('伊布')).toBeInTheDocument();
    expect(screen.getByText('水伊布')).toBeInTheDocument();
    expect(screen.getByText('雷伊布')).toBeInTheDocument();
    expect(screen.getByText('使用 水之石')).toBeInTheDocument();
    expect(screen.getByText(/分支进化/)).toBeInTheDocument();
  });
});
