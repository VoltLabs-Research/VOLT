import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import type { ChatReaction } from '@/modules/chat/api/entities/message';
import './ReactionsDisplay.css';

interface ReactionsDisplayProps {
    reactions?: ChatReaction[];
    currentUserId?: string;
    onToggle: (emoji: string) => void;
};

const ReactionsDisplay = ({ reactions = [], currentUserId, onToggle }: ReactionsDisplayProps) => {
    const validReactions = reactions.filter((r) => (r.users?.length ?? 0) > 0);
    
    if (validReactions.length === 0) return null;

    const hasUserReacted = (reaction: ChatReaction): boolean => {
        if (!currentUserId) return false;
        return reaction.users.some((user) => {
            let userId = user;

            if (typeof user !== 'string') {
                userId = user._id;
            }

            return userId === currentUserId;
        });
    };

    return (
        <Container className='d-flex flex-wrap gap-025 chat-reactions-display'>
            {validReactions.map((reaction) => (
                <button
                    key={reaction.emoji}
                    type='button'
                    className={cn(
                        'd-flex items-center gap-025 font-size-2 cursor-pointer chat-reaction transition-normal',
                        hasUserReacted(reaction) && 'user-reacted'
                    )}
                    onClick={() => onToggle(reaction.emoji)}
                    aria-pressed={hasUserReacted(reaction)}
                    aria-label={`${reaction.emoji} reaction, ${reaction.users.length} ${reaction.users.length === 1 ? 'person' : 'people'}`}
                >
                    {reaction.emoji} {reaction.users.length}
                </button>
            ))}
        </Container>
    );
};

export default ReactionsDisplay;
