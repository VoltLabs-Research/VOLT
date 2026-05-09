import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import { cn } from '@/shared/utils/cn';
import type { ChatReaction } from '@/modules/chat/api/entities/message';
import './ReactionsDisplay.css';

interface ReactionsDisplayProps {
    reactions?: ChatReaction[];
    currentUserId?: string;
    onToggle: (emoji: string) => void;
}

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
        <Box display='flex' wrap gap='025' className='chat-reactions-display'>
            {validReactions.map((reaction) => (
                <Button
                    key={reaction.emoji}
                    variant='outline'
                    size='sm'
                    shape='pill'
                    className={cn(
                        'font-size-2 chat-reaction',
                        hasUserReacted(reaction) && 'user-reacted'
                    )}
                    onClick={() => onToggle(reaction.emoji)}
                    aria-pressed={hasUserReacted(reaction)}
                    aria-label={`${reaction.emoji} reaction, ${reaction.users.length} ${reaction.users.length === 1 ? 'person' : 'people'}`}
                >
                    {reaction.emoji} {reaction.users.length}
                </Button>
            ))}
        </Box>
    );
};

export default ReactionsDisplay;
