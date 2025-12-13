import IconButton from '@/components/atoms/common/IconButton';
import type { Chat, Participant, Presence } from '@/types/chat';
import { getInitials } from '@/utilities/guest';
import {
    IoCallOutline,
    IoVideocamOutline,
    IoInformationCircleOutline,
    IoPeopleOutline } from 'react-icons/io5';

export type ChatHeaderProps = {
    chat: Chat;
    currentParticipant?: Participant | null;
    presence: Presence;
};

const ChatHeader = ({ chat, currentParticipant, presence }: ChatHeaderProps) => {
    return(
        <div className='chat-box-header-container'>
            <div className='chat-header-user'>
                <div className={`chat-header-avatar ${chat.isGroup ? 'group-avatar' : ''}`}>
                    {chat.isGroup
                        ? <IoPeopleOutline />
                        : currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                </div>
                <div className='chat-header-info'>
                    <h3 className='chat-header-name'>
                     {chat.isGroup ? chat.groupName : currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                    </h3>
                    <div className='chat-header-status'>
                        {chat.isGroup ? `${chat.participants.length} members` : presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                    </div>
                </div>
            </div>
            <div className='chat-header-actions'>
                <IconButton label='Call' className='chat-header-action'>
                    <IoCallOutline />
                </IconButton>
                <IconButton label='Video Call' className='chat-header-action'>
                    <IoVideocamOutline />
                </IconButton>
                <IconButton label='More Info' className='chat-header-action'>
                    <IoInformationCircleOutline />
                </IconButton>
            </div>
        </div>
    );
};

export default ChatHeader;
