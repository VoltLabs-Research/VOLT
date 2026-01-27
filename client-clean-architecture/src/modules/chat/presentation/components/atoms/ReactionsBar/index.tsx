import type { Reaction } from '@/types/chat';
import '@/modules/chat/presentation/components/atoms/ReactionsBar/ReactionsBar.css';
import Container from '@/shared/presentation/components/primitives/Container';

type ReactionsBarProps = {
    reactions?: Reaction[];
    onToggle: (emoji: string) => void;
}

const ReactionsBar = ({
    reactions = [],
    onToggle
}: ReactionsBarProps) => {
    if(!reactions.length) return null;

    return(
        <Container className='d-flex flex-wrap p-absolute gap-025 chat-message-reactions-display'>
            {reactions.filter(r => (r.users?.length ?? 0) > 0).map((r) => (
                <span key={r.emoji} className='d-flex items-center gap-025 font-size-1 color-muted cursor-pointer chat-reaction' onClick={() => onToggle(r.emoji)}>
                    {r.emoji} {r.users?.length ?? 0}
                </span>
            ))}
        </Container>
    );
};

export default ReactionsBar;
