import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
                <Paragraph
                    key={reaction.emoji}
                    className={cn(
                        'd-flex items-center gap-025 font-size-1 cursor-pointer chat-reaction transition-normal',
                        hasUserReacted(reaction) && 'user-reacted'
                    )}
                    onClick={() => onToggle(reaction.emoji)}
                >
                    {reaction.emoji} {reaction.users.length}
                </Paragraph>
            ))}
        </Container>
    );
};

export default ReactionsDisplay;
