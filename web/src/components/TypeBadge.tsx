import type { TypeInfo, TypeName } from '../types';

// 18 属性官方配色
export const TYPE_COLORS: Record<TypeName, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

export function TypeBadge({ type, small }: { type: TypeInfo; small?: boolean }) {
  const color = TYPE_COLORS[type.name] ?? '#888';
  return (
    <span
      className={`inline-block rounded-full font-semibold text-white border-2 border-black/20 ${
        small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'
      }`}
      style={{ backgroundColor: color, textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}
      title={type.name}
    >
      {type.nameZh}
    </span>
  );
}
