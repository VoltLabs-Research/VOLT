import type { ReactNode } from 'react';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import ReactionsDisplay from '../ReactionsDisplay';
import UserAvatar from '../UserAvatar';
import { cn } from '@heroui/react';
import { formatDistanceToNow } from 'date-fns';
import FileAttachment from '@/shared/ui/components/FileAttachment';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    isGroupChat?: boolean;
    currentUserId?: string;
    onToggleReaction?: (emoji: string) => void;
    children?: ReactNode;
}

/*
 * `group/bubble` replaces what MessageBubble.css published to MessageControls:
 * `.message-bubble:hover .message-controls`. The group is named because
 * FileAttachment renders its own unnamed `group` inside this subtree, and an
 * unnamed group here would make the attachment's copy button appear on bubble
 * hover too.
 *
 * `animate-[animate-fade-in_…]` needs `@keyframes animate-fade-in`, which lived in
 * bravais's stylesheet and has to be re-declared globally — reported, not kept
 * here. The entrance is already absent today for the same reason.
 */
const BUBBLE_CLASS_NAMES = 'group/bubble flex gap-3 max-w-[70%] max-[768px]:max-w-[85%] animate-[animate-fade-in_0.3s_ease]';

/**
 * The bubble's own surface.
 *
 * Light mode is the base and dark mode the override, because that is the only way
 * to express a `[data-theme='light']`-scoped rule as a utility — and the two rules
 * being inverted here were doing real damage. `:root[data-theme='light']
 * .message-bubble-content` and `.message-bubble.sent .message-bubble-content` have
 * the same specificity, and the light one was written later, so in light mode it
 * won: a sent bubble got the *received* background while keeping
 * `color: var(--color-on-accent)`, i.e. near-white text on a near-white surface.
 * The deleted variant lost its dashed well the same way.
 *
 * So the tone classes below are ordered by intent instead of by accident: sent and
 * deleted are applied after the base and win in both themes.
 */
const CONTENT_CLASS_NAMES = 'p-3 relative rounded-[1.25rem_1.25rem_1.25rem_0.25rem] border text-foreground bg-surface border-border shadow-[0_1px_3px_color-mix(in_srgb,var(--foreground)_8%,transparent)] dark:bg-surface-secondary dark:shadow-none';

const SENT_CONTENT_CLASS_NAMES = 'rounded-[1.25rem_1.25rem_0.25rem_1.25rem] bg-accent border-accent text-accent-foreground shadow-none';

const DELETED_CONTENT_CLASS_NAMES = 'bg-[color-mix(in_srgb,var(--surface-tertiary)_88%,var(--background))] border-dashed border-border text-muted shadow-none';

const FILE_CLASS_NAMES = 'rounded-lg bg-surface-secondary dark:bg-surface-tertiary';

/* Ink on the accent surface, not ink on the page: the tile sits inside a sent
   bubble, so 10% of the bubble's own foreground is what reads as translucent. */
const SENT_FILE_CLASS_NAMES = 'bg-accent-foreground/10 dark:bg-accent-foreground/10';

const MessageBubble = ({
    message,
    isOwn,
    isGroupChat = false,
    currentUserId,
    onToggleReaction,
    children
}: MessageBubbleProps) => {
    const showAvatar = isGroupChat && !isOwn;
    const isFile = message.messageType === ChatMessageType.File;
    const isDeleted = message.deleted;
    let messageContent: ReactNode;

    if (isDeleted) {
        messageContent = (
            <p className='text-sm text-muted italic break-words leading-normal'>
                This message was deleted
            </p>
        );
    } else if (isFile) {
        messageContent = (
            <FileAttachment
                fileName={message.metadata?.fileName}
                fileSize={message.metadata?.fileSize}
                fileUrl={message.metadata?.fileUrl}
                fileType={message.metadata?.fileType}
                showDownload={!!message.metadata?.fileUrl}
                className={cn(FILE_CLASS_NAMES, isOwn && SENT_FILE_CLASS_NAMES)}
            />
        );
    } else {
        messageContent = (
            <p className='text-sm break-words leading-normal'>
                {message.content}
            </p>
        );
    }

    return (
        <div className={cn(BUBBLE_CLASS_NAMES, isOwn ? 'ml-auto' : 'mr-auto')}>
            {showAvatar && (
                <UserAvatar
                    user={message.sender}
                    size='xs'
                    className='size-8 bg-surface-tertiary text-muted'
                />
            )}

            <div className='flex flex-col w-full'>
                {showAvatar && (
                    <p className='text-sm font-semibold text-muted pl-2 mb-1'>
                        {message.sender.firstName} {message.sender.lastName}
                    </p>
                )}

                <div className={cn(
                    CONTENT_CLASS_NAMES,
                    isOwn && SENT_CONTENT_CLASS_NAMES,
                    isDeleted && DELETED_CONTENT_CLASS_NAMES
                )}>
                    {messageContent}

                    {!isDeleted && children}
                </div>

                <div className={cn(
                    'flex flex-row items-center gap-2 mt-2 text-sm',
                    isOwn ? 'text-foreground/70' : 'text-muted',
                    isDeleted && 'text-muted'
                )}>
                    <p>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</p>
                </div>

                {!isDeleted && message.reactions && message.reactions.length > 0 && (
                    <ReactionsDisplay
                        reactions={message.reactions}
                        currentUserId={currentUserId}
                        onToggle={onToggleReaction ?? (() => undefined)}
                    />
                )}
            </div>
        </div>
    );
};

export default MessageBubble;
