import {
    MESSAGE_BUBBLE,
    MESSAGE_BUBBLE_ASSISTANT,
    THINKING_BUBBLE
} from '@/modules/ai/components/AIConversationThread/thread-styles';

/**
 * bravais's `ThinkingDots` rebuilt from the three spans the spec calls for.
 *
 * Two details are deliberate. The `role='status'` + `aria-live='polite'` + visually
 * hidden label are the whole point of the component — a bare three-div swap would stop
 * announcing "Assistant is thinking" — so they are kept exactly. And the staggered delays
 * are written as arbitrary properties rather than with an `animate-delay` utility because
 * the original delays came from `:nth-child(2|3|4)` (the label is child 1), so no dot
 * started at 0; that stagger is reproduced here directly.
 *
 * `animate-pulse` stands in for bravais's own `volt-thinking-dot` keyframes, which also
 * hopped each dot 2px. The global reduced-motion block in `index.css` neutralises it,
 * which is what the component's own reduced-motion rule did.
 */
const DOT = 'size-1.5 rounded-full bg-muted animate-pulse animation-duration-[1200ms]';

const ThinkingBubble = () => (
    <div className={`${MESSAGE_BUBBLE} ${MESSAGE_BUBBLE_ASSISTANT} ${THINKING_BUBBLE}`}>
        <span className='inline-flex items-center gap-1' role='status' aria-live='polite'>
            <span className='sr-only'>Assistant is thinking</span>
            <span className={`${DOT} [animation-delay:0.15s]`} aria-hidden='true' />
            <span className={`${DOT} [animation-delay:0.3s]`} aria-hidden='true' />
            <span className={`${DOT} [animation-delay:0.45s]`} aria-hidden='true' />
        </span>
    </div>
);

export default ThinkingBubble;
