
import IconButton from '@/components/atoms/common/IconButton';
import type { Chat, Participant, Presence } from '@/types/chat';
import { getInitials } from '@/utilities/guest';
import {
    IoCallOutline,
    IoVideocamOutline,
    IoInformationCircleOutline,
    IoPeopleOutline
} from 'react-icons/io5';
import Title from '@/components/primitives/Title';
import './ChatHeader.css';

export type ChatHeaderProps = {
    chat: Chat;
    currentParticipant?: Participant | null;
    presence: Presence;
};

const ChatHeader = ({ chat, currentParticipant, presence }: ChatHeaderProps) => {
    return (
        <div className='d-flex items-center content-between chat-box-header-container'>
            <div className='d-flex items-center gap-1 chat-header-user'>
                <div className={`d-flex flex-center chat-header-avatar ${chat.isGroup ? 'group-avatar' : ''}`}>
                    {chat.isGroup
                        ? <IoPeopleOutline />
                        : currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                </div>
                <div className='d-flex column chat-header-info'>
                    <Title className='font-size-3 chat-header-name'>
                        {chat.isGroup ? chat.groupName : currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName} ` : 'Unknown'}
                    </Title>
                    <div className='d-flex items-center gap-05 chat-header-status'>
                        {chat.isGroup ? `${chat.participants.length} members` : presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                    </div>
                </div>
            </div>
            <div className='d-flex items-center gap-075 chat-header-actions'>
                <IconButton label='Call' className='d-flex flex-center chat-header-action'>
                    <IoCallOutline />
                </IconButton>
                <IconButton label='Video Call' className='d-flex flex-center chat-header-action'>
                    <IoVideocamOutline />
                </IconButton>
                <IconButton label='More Info' className='d-flex flex-center chat-header-action'>
                    <IoInformationCircleOutline />
                </IconButton>
            </div>
        </div>
    );
};

export default ChatHeader;
