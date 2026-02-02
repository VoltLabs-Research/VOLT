import { IoInformationCircleOutline } from 'react-icons/io5';
import type { Chat, PresenceStatus } from '@/modules/chat/domain/entities';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusDot from '@/shared/presentation/components/StatusDot';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { ChatAvatar } from '../../atoms';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/presentation/utilities';
import './ChatHeader.css';

interface ChatHeaderProps {
    chat: Chat;
    currentUserId?: string;
    presence?: PresenceStatus;
    onInfoClick?: () => void;
};

const ChatHeader = ({ chat, currentUserId, presence = 'unknown', onInfoClick }: ChatHeaderProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);

    return (
        <Container className='d-flex items-center content-between chat-header'>
            <Container className='d-flex items-center gap-1'>
                <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />
                
                <Container className='d-flex column'>
                    <Paragraph className='font-size-3 font-weight-6 color-primary'>
                        {displayName}
                    </Paragraph>
                    {statusText && (
                        <Container className='d-flex items-center gap-05 chat-header-status'>
                            {!chat.isGroup && (
                                <StatusDot isOnline={presence === 'online'} />
                            )}
                            <Paragraph className='color-muted'>{statusText}</Paragraph>
                        </Container>
                    )}
                </Container>
            </Container>

            <Container className='d-flex items-center gap-05'>
                {onInfoClick && (
                    <Tooltip content='Chat Info'>
                        <IconButton onClick={onInfoClick}>
                            <IoInformationCircleOutline size={20} />
                        </IconButton>
                    </Tooltip>
                )}
            </Container>
        </Container>
    );
};

export default ChatHeader;
