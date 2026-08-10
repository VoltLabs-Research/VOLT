import { getChatDisplayName } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { cn } from '@heroui/react';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@volt/contracts/modules/chat/domain';

interface ChatListItemProps {
    chat: Chat;
    currentUserId?: string;
    isActive?: boolean;
    onClick: () => void;
}

/**
 * bravais's `ListRow`, inlined.
 *
 * The row is a `<button>` because that is the element ListRow resolved to as soon
 * as it was given an `onClick`, and everything it painted came from two
 * stylesheets rather than from the JSX: the 1px *transparent* border that keeps
 * the selected state from shifting layout, the `min-w-0` on the content column
 * that makes `truncate` work at all, and the hover/focus feedback that lived in
 * bravais's `.list-item-hoverable` composite. All three are here.
 *
 * The focus ring is this component's own, not the composite's — ChatListItem.css
 * overrode it with a two-step shadow, which is what the app uses everywhere a row
 * sits on a tinted surface.
 */
const ROW_CLASS_NAMES = 'flex w-full items-center gap-3 min-h-12 p-3 rounded-xl border border-transparent bg-transparent text-left text-inherit cursor-pointer transition-colors duration-200 hover:bg-surface-tertiary focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)]';

const SELECTED_CLASS_NAMES = 'bg-surface-tertiary border-border';

const ChatListItem = ({ chat, currentUserId, isActive, onClick }: ChatListItemProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);

    return (
        <button
            type='button'
            className={cn(ROW_CLASS_NAMES, isActive && SELECTED_CLASS_NAMES)}
            onClick={onClick}
            aria-pressed={isActive || undefined}
            aria-current={isActive ? 'page' : undefined}
        >
            <div className='flex items-center shrink-0' aria-hidden='true'>
                <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />
            </div>

            <div className='flex flex-col gap-1 overflow-hidden flex-1 min-w-0'>
                <div className='flex flex-row items-center justify-between gap-2'>
                    <p className='text-base font-semibold truncate m-0'>
                        {displayName}
                    </p>
                    {chat.lastMessageAt && (
                        <p className='text-sm text-muted whitespace-nowrap'>
                            {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                        </p>
                    )}
                </div>

                {chat.lastMessage && (
                    <p className='text-sm text-muted truncate max-w-[180px]'>
                        {chat.lastMessage.content}
                    </p>
                )}

                {chat.isGroup && (
                    <p className='text-sm text-muted'>
                        {chat.participants.length} members
                    </p>
                )}
            </div>
        </button>
    );
};

export default ChatListItem;
