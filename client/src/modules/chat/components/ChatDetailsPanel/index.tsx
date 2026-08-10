import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { MessagesSquare, Users } from 'lucide-react';
import { Button } from '@heroui/react';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { GROUP_MANAGEMENT_MODAL_ID } from '../GroupManagementModal';
import { openModal } from '@/shared/ui/modal';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';

interface ChatDetailsPanelProps {
    chat: Chat | null;
    messages: ChatMessage[];
    currentUserId?: string;
    presence?: PresenceStatus;
    onClose?: () => void;
}

/*
 * `chat-details` stays on the root: MessagesPage's state flags still decide
 * whether this pane is a 320px rail beside the thread or the whole viewport, and
 * the two rules that used to do that from MessagesPage.css are the last variants
 * below. Under 1024px the rail is hidden unless it is the open pane, in which case
 * it takes the width.
 */
const PANEL_CLASS_NAMES = 'flex flex-col h-full w-[320px] min-w-[320px] border-l border-border bg-background chat-details max-[1024px]:hidden max-[1024px]:w-full max-[1024px]:min-w-0 max-[1024px]:border-l-0 max-[1024px]:[.messages-page--details-open_&]:flex';

const SECTION_CLASS_NAMES = 'py-4 border-b border-border last:border-b-0';

const SECTION_TITLE_CLASS_NAMES = 'block mb-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted';

const ChatDetailsPanel = ({
    chat,
    messages,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onClose
}: ChatDetailsPanelProps) => {
    if (!chat) {
        return (
            <div className={PANEL_CLASS_NAMES}>
                <PanelHeader title='Details' />
                <div className='flex flex-1 items-center justify-center'>
                    <RecoveryState
                        icon={<MessagesSquare size={32} />}
                        title='No chat selected'
                        description='Select a conversation to view details'
                    />
                </div>
            </div>
        );
    }

    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);
    const headerTitle = chat.isGroup ? 'Group Info' : 'Contact Info';

    return (
        <div className={PANEL_CLASS_NAMES}>
            <PanelHeader
                title={headerTitle}
                onClose={onClose}
            />

            <div className='flex flex-col overflow-y-auto flex-1 p-6'>
                <div className={`flex flex-col items-center gap-3 text-center ${SECTION_CLASS_NAMES}`}>
                    <ChatAvatar
                        chat={chat}
                        currentUserId={currentUserId}
                        size='lg'
                        showStatus={!chat.isGroup}
                        isOnline={presence === PresenceStatus.Online}
                    />
                    <p className='text-xl font-semibold'>
                        {displayName}
                    </p>
                    {statusText && (
                        <p className='text-sm text-muted'>{statusText}</p>
                    )}
                    {chat.isGroup && chat.groupDescription && (
                        <p className='text-sm text-muted'>
                            {chat.groupDescription}
                        </p>
                    )}
                </div>

                {chat.isGroup && (
                    <div className={SECTION_CLASS_NAMES}>
                        <span className={SECTION_TITLE_CLASS_NAMES}>
                            Actions
                        </span>
                        <Button
                            variant='ghost'
                            fullWidth
                            className='justify-start'
                            onPress={() => openModal(GROUP_MANAGEMENT_MODAL_ID)}
                        >
                            <Users />
                            Manage Group
                        </Button>
                    </div>
                )}

                <div className={SECTION_CLASS_NAMES}>
                    <span className={SECTION_TITLE_CLASS_NAMES}>
                        Shared Files
                    </span>
                    <SharedFilesList messages={messages} />
                </div>
            </div>
        </div>
    );
};

export default ChatDetailsPanel;
