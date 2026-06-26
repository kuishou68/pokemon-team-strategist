import type { Card } from '../types';
import { PokemonCard } from './PokemonCard';
import { MoveCard } from './MoveCard';
import { MatchupsCard } from './MatchupsCard';
import { EvolutionChain } from './EvolutionChain';
import { AnalysisCard } from './AnalysisCard';
import { SwitchCard } from './SwitchCard';

export function CardRenderer({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;
  return (
    <div className="flex flex-col gap-2 mt-2 items-start">
      {cards.map((card, i) => {
        switch (card.kind) {
          case 'pokemon':
            return <PokemonCard key={`${card.data.id}-${i}`} data={card.data} />;
          case 'move':
            return <MoveCard key={`${card.data.id}-${i}`} data={card.data} />;
          case 'matchups':
            return <MatchupsCard key={`mu-${card.data.type.name}-${i}`} data={card.data} />;
          case 'evolution':
            return <EvolutionChain key={`evo-${card.data.rootId}-${i}`} data={card.data} />;
          case 'analysis':
            return <AnalysisCard key={`an-${i}`} data={card.data} />;
          case 'switch':
            return <SwitchCard key={`sw-${card.data.opponent.id}-${i}`} data={card.data} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
