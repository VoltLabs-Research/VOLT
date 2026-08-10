import type { TypingUser } from '@volt/contracts/modules/chat/domain';

interface TypingIndicatorProps {
    users: TypingUser[];
}

/*
 * bravais's `ThinkingDots` carried its own `role='status'` and a visually-hidden
 * label. Nested inside the live region this component already had, and with the
 * label set to the very message rendered visibly beside it, a screen reader was
 * given the sentence twice. The dots are decorative here — the outer region and
 * the visible text do the announcing — so they are marked `aria-hidden`.
 *
 * The `@keyframes volt-thinking-dot` the animation names is reported for the global
 * sheet; a keyframe block is the one thing a utility cannot declare. The delays
 * are bravais's: no dot starts at zero, because its `nth-child` selectors counted
 * the sr-only label as the first child.
 */
const DOT_CLASS_NAMES = 'size-1 rounded-full bg-muted opacity-40 animate-[volt-thinking-dot_1.2s_ease-in-out_infinite]';

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
    const typingUsers = users.filter((u) => u.isTyping);

    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.userName).join(', ');
    const message = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`;

    return (
        <div className='flex gap-2 mb-12' role='status' aria-live='polite' aria-atomic='true'>
            <div className='flex flex-row items-center gap-2 max-w-fit px-4 py-3 rounded-2xl border border-border bg-surface-tertiary'>
                <span className='inline-flex items-center gap-1' aria-hidden='true'>
                    <span className={`${DOT_CLASS_NAMES} [animation-delay:0.15s]`} />
                    <span className={`${DOT_CLASS_NAMES} [animation-delay:0.3s]`} />
                    <span className={`${DOT_CLASS_NAMES} [animation-delay:0.45s]`} />
                </span>
                <p className='text-sm text-muted'>
                    {message}
                </p>
            </div>
        </div>
    );
};

export default TypingIndicator;
