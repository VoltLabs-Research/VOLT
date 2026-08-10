import { Button, cn } from '@heroui/react';
import { hasUserReacted } from '@/modules/chat/utils/reactions';
import type { ChatReaction } from '@volt/contracts/modules/chat/domain';

interface ReactionsDisplayProps {
    reactions?: ChatReaction[];
    currentUserId?: string;
    onToggle: (emoji: string) => void;
}

/**
 * A reaction chip.
 *
 * `shape='pill'` on the old Button was overruled by the stylesheet's
 * `border-radius: var(--radius-sm)`, so these were never pills — 8px is what
 * shipped, and `rounded-lg` is 8px here.
 *
 * Light mode is the base and dark the override, the same inversion as
 * MessageBubble and for the same reason: `:root[data-theme='light']
 * .chat-reaction` outranked `.chat-reaction.user-reacted`, so in light mode a
 * reaction the reader had left lost its accent fill but kept its on-accent text —
 * white on white. Here the reacted state is applied last and wins in both themes.
 */
const REACTION_CLASS_NAMES = 'min-h-10 px-2.5 py-1.5 rounded-lg border border-border text-sm text-foreground bg-surface hover:bg-surface-secondary shadow-[0_1px_3px_color-mix(in_srgb,var(--foreground)_8%,transparent)] dark:bg-surface-tertiary dark:hover:bg-default dark:shadow-[0_1px_3px_color-mix(in_srgb,var(--foreground)_10%,transparent)] focus-visible:outline-none focus-visible:border-focus focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]';

/* Hover shifts weight, not hue: a second accent for a hover state is noise. */
const REACTED_CLASS_NAMES = 'bg-accent border-accent text-accent-foreground hover:bg-[color-mix(in_srgb,var(--accent)_82%,var(--background))] hover:border-[color-mix(in_srgb,var(--accent)_82%,var(--background))] dark:bg-accent dark:hover:bg-[color-mix(in_srgb,var(--accent)_82%,var(--background))]';

const ReactionsDisplay = ({ reactions = [], currentUserId, onToggle }: ReactionsDisplayProps) => {
    if (reactions.length === 0) return null;

    return (
        <div className='flex flex-wrap gap-1 z-10'>
            {reactions.map((reaction) => {
                const isReacted = hasUserReacted(reaction, currentUserId);

                return (
                    <Button
                        key={reaction.emoji}
                        variant='secondary'
                        size='sm'
                        className={cn(REACTION_CLASS_NAMES, isReacted && REACTED_CLASS_NAMES)}
                        onPress={() => onToggle(reaction.emoji)}
                        aria-pressed={isReacted}
                        aria-label={`${reaction.emoji} reaction, ${reaction.users.length} ${reaction.users.length === 1 ? 'person' : 'people'}`}
                    >
                        {reaction.emoji} {reaction.users.length}
                    </Button>
                );
            })}
        </div>
    );
};

export default ReactionsDisplay;
