import type { ChatMessage } from '../types';
import { CardRenderer } from './CardRenderer';
import { ToolTrace } from './ToolTrace';

export function MessageBubble({ message, busy }: { message: ChatMessage; busy?: boolean }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`gb-dialog px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            isUser ? 'bg-poke-blue text-white' : 'bg-white'
          }`}
          style={isUser ? { boxShadow: '3px 3px 0 0 rgba(0,0,0,0.2)' } : undefined}
        >
          {message.content || (busy && !isUser ? (
            <span className="inline-flex items-center gap-2 text-slate-400">
              <span className="pokeball-spin" /> 思考中…
            </span>
          ) : (
            ''
          ))}
        </div>
        {!isUser && message.steps && message.steps.length > 0 && (
          <ToolTrace steps={message.steps} />
        )}
        {!isUser && message.cards && message.cards.length > 0 && (
          <CardRenderer cards={message.cards} />
        )}
      </div>
    </div>
  );
}
