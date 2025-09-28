import type { Reaction } from '@/types/chat';

type ReactionsBarProps = {
    reactions?: Reaction[];
    onToggle: (emoji: string) => void;
}

const ReactionsBar = ({
    reactions = [],
    onToggle
}: ReactionsBarProps) => {
    if(!reactions.length) return null;

    return (
        <div className='chat-message-reactions-display'>
            {reactions.filter(r => (r.users?.length ?? 0) > 0).map((r) => (
                <span key={r.emoji} className='chat-reaction' onClick={() => onToggle(r.emoji)}>
                    {r.emoji} {r.users?.length ?? 0}
                </span>
            ))}
        </div>
    );
};

export default ReactionsBar;