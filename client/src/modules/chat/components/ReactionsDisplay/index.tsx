import { Button } from '@voltstack/bravais';
import { cn } from '@/shared/utils/cn';
import { hasUserReacted } from '@/modules/chat/utils/reactions';
import type { ChatReaction } from '@volt/contracts/modules/chat/domain';
import './ReactionsDisplay.css';

interface ReactionsDisplayProps {
    reactions?: ChatReaction[];
    currentUserId?: string;
    onToggle: (emoji: string) => void;
}

const ReactionsDisplay = ({ reactions = [], currentUserId, onToggle }: ReactionsDisplayProps) => {
    if (reactions.length === 0) return null;

    return (
        <div className='flex flex-wrap gap-1 chat-reactions-display'>
            {reactions.map((reaction) => (
                <Button
                    key={reaction.emoji}
                    variant='outline'
                    size='sm'
                    shape='pill'
                    className={cn(
                        'text-sm chat-reaction',
                        hasUserReacted(reaction, currentUserId) && 'user-reacted'
                    )}
                    onClick={() => onToggle(reaction.emoji)}
                    aria-pressed={hasUserReacted(reaction, currentUserId)}
                    aria-label={`${reaction.emoji} reaction, ${reaction.users.length} ${reaction.users.length === 1 ? 'person' : 'people'}`}
                >
                    {reaction.emoji} {reaction.users.length}
                </Button>
            ))}
        </div>
    );
};

export default ReactionsDisplay;
