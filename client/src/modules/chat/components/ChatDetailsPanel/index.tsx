import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { MessagesSquare, Users } from 'lucide-react';
import { Button, EmptyState } from '@voltstack/bravais';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { GROUP_MANAGEMENT_MODAL_ID } from '../GroupManagementModal';
import { openModal } from '@/shared/ui/modal';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import './ChatDetailsPanel.css';

interface ChatDetailsPanelProps {
    chat: Chat | null;
    messages: ChatMessage[];
    currentUserId?: string;
    presence?: PresenceStatus;
    onClose?: () => void;
}

const ChatDetailsPanel = ({
    chat,
    messages,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onClose
}: ChatDetailsPanelProps) => {
    if (!chat) {
        return (
            <div className='flex flex-col h-full chat-details'>
                <PanelHeader title='Details' />
                <div className='flex flex-1 items-center justify-center'>
                    <EmptyState
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
        <div className='flex flex-col h-full chat-details'>
            <PanelHeader
                title={headerTitle}
                onClose={onClose}
                className='chat-details-header'
            />

            <div className='flex flex-col overflow-y-auto flex-1 chat-details-content'>
                <div className='flex flex-col items-center gap-3 text-center chat-details-section'>
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
                    <div className='chat-details-section'>
                        <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted chat-details-section-title block mb-3'>
                            Actions
                        </span>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            leftIcon={<Users />}
                            block
                            align='start'
                            onClick={() => openModal(GROUP_MANAGEMENT_MODAL_ID)}
                        >
                            Manage Group
                        </Button>
                    </div>
                )}

                <div className='chat-details-section'>
                    <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted chat-details-section-title block mb-3'>
                        Shared Files
                    </span>
                    <SharedFilesList messages={messages} />
                </div>
            </div>
        </div>
    );
};

export default ChatDetailsPanel;
