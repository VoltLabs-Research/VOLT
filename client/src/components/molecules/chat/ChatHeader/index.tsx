
import Button from '@/components/primitives/Button';
import type { Chat, Participant, Presence } from '@/types/chat';
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
        <div className='d-flex items-center content-between chat-box-header-container p-relative'>
            <div className='d-flex items-center gap-1 chat-header-user'>
                <div className={`d-flex flex-center chat-header-avatar ${chat.isGroup ? 'group-avatar' : ''} font-size-3 font-weight-6 overflow-hidden`}>
                    {chat.isGroup
                        ? <IoPeopleOutline />
                        : currentParticipant?.avatar
                            ? <img src={currentParticipant.avatar} alt="" className='w-max h-max object-cover' />
                            : '?'}
                </div>
                <div className='d-flex column chat-header-info'>
                    <Title className='font-size-3 chat-header-name font-weight-6 color-primary'>
                        {chat.isGroup ? chat.groupName : currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName} ` : 'Unknown'}
                    </Title>
                    <div className='d-flex items-center gap-05 chat-header-status font-weight-5'>
                        {chat.isGroup ? `${chat.participants.length} members` : presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                    </div>
                </div>
            </div>
            <div className='d-flex items-center gap-075 chat-header-actions'>
                <Button variant='ghost' intent='neutral' iconOnly size='sm' title='Call'>
                    <IoCallOutline />
                </Button>
                <Button variant='ghost' intent='neutral' iconOnly size='sm' title='Video Call'>
                    <IoVideocamOutline />
                </Button>
                <Button variant='ghost' intent='neutral' iconOnly size='sm' title='More Info'>
                    <IoInformationCircleOutline />
                </Button>
            </div>
        </div>
    );
};

export default ChatHeader;
