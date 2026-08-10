import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { ArrowLeft, Info } from 'lucide-react';
import { Button, Tooltip, cn } from '@heroui/react';
import type { Chat } from '@volt/contracts/modules/chat/domain';

interface ChatHeaderProps {
    chat: Chat;
    currentUserId?: string;
    presence?: PresenceStatus;
    onBackClick?: () => void;
    onInfoClick?: () => void;
    isDetailsOpen?: boolean;
}

/*
 * bravais sized the header's icon buttons past HeroUI's 32px `sm` so a thumb can
 * hit them, and the sheet did it with `.chat-header .volt-icon-button`.
 *
 * The `backdrop-filter: var(--glass-blur)` on the header is gone with no
 * replacement, and nothing is lost: glass was flattened onto solid surfaces
 * before this migration, and `--glass-blur` has been `none` ever since. The
 * light-theme `border-bottom-color: var(--material-regular-border)` override goes
 * the same way — that token now resolves to `--border`, the value the base rule
 * already used.
 */
const HEADER_BUTTON_CLASS_NAMES = 'min-w-11 min-h-11';

/* The back button is the mobile affordance for leaving a chat: at wider widths
   the conversation list is on screen already and there is nothing to go back to. */
const BACK_BUTTON_CLASS_NAMES = 'hidden max-[768px]:inline-flex min-w-11 min-h-11';

const ChatHeader = ({
    chat,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onBackClick,
    onInfoClick,
    isDetailsOpen = false
}: ChatHeaderProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);
    const infoLabel = isDetailsOpen ? 'Hide chat details' : 'Show chat details';
    const isOnline = presence === PresenceStatus.Online;

    return (
        <div className='flex flex-row items-center justify-between px-6 py-4 border-b border-border max-[768px]:px-4 max-[768px]:py-3.5'>
            <div className='flex flex-row items-center gap-4'>
                {onBackClick && (
                    <Tooltip>
                        <Button
                            size='sm'
                            variant='ghost'
                            isIconOnly
                            className={BACK_BUTTON_CLASS_NAMES}
                            onPress={onBackClick}
                            aria-label='Back to conversations'
                        >
                            <ArrowLeft size={20} />
                        </Button>
                        <Tooltip.Content>Back to conversations</Tooltip.Content>
                    </Tooltip>
                )}

                <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />

                <div className='flex flex-col'>
                    <p className='text-base font-semibold'>
                        {displayName}
                    </p>
                    {statusText && (
                        <div className='flex flex-row items-center gap-2'>
                            {!chat.isGroup && (
                                <span
                                    className={cn(
                                        'size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]',
                                        isOnline ? 'bg-success' : 'bg-muted'
                                    )}
                                    role='status'
                                    aria-label={isOnline ? 'success status' : 'neutral status'}
                                />
                            )}
                            <p className='text-sm text-muted'>{statusText}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className='flex flex-row items-center gap-2'>
                {onInfoClick && (
                    <Tooltip>
                        <Button
                            size='sm'
                            variant='ghost'
                            isIconOnly
                            className={HEADER_BUTTON_CLASS_NAMES}
                            onPress={onInfoClick}
                            aria-label={infoLabel}
                            aria-pressed={isDetailsOpen}
                        >
                            <Info size={20} />
                        </Button>
                        <Tooltip.Content>{infoLabel}</Tooltip.Content>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default ChatHeader;
