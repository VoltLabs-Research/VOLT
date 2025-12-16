import type { Chat, Message, Participant } from '@/types/chat';
import { getInitials } from '@/utilities/guest';
import MessageSkeleton from '@/components/atoms/chat/MessageSkeleton';
import { IoChatbubblesOutline, IoCallOutline, IoVideocamOutline, IoPeopleOutline, IoInformationCircleOutline } from 'react-icons/io5';
import SharedFilesList from '@/components/molecules/chat/SharedFilesList';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import Button from '@/components/primitives/Button';
import './DetailsPanel.css';

type DetailsPanelProps = {
    chat: Chat | null | undefined;
    messages: Message[];
    isLoading: boolean;
    presence: 'online' | 'offline' | 'connecting';
    onOpenGroupManagement: () => void;
    currentParticipant?: Participant | null;
};

const DetailsPanel = ({
    chat,
    messages,
    isLoading,
    presence,
    onOpenGroupManagement,
    currentParticipant
}: DetailsPanelProps) => {
    return (
        <div className='d-flex column chat-details-container'>
            <div className='chat-details-header'>
                <Title className='chat-details-title'>{chat?.isGroup ? 'Group Info' : 'Contact Info'}</Title>
            </div>
            <div className='chat-details-content'>
                {!chat ? (
                    <div className='d-flex column flex-center chat-no-selection'>
                        <div className='d-flex flex-center chat-no-selection-icon'>
                            <IoChatbubblesOutline />
                        </div>
                        <Title className='font-size-3 chat-no-selection-title'>No chat selected</Title>
                        <Paragraph className='chat-no-selection-description'>Select a conversation to view details</Paragraph>
                    </div>
                ) : isLoading ? (
                    <MessageSkeleton variant='contact' />
                ) : chat.isGroup ? (
                    <div className='chat-details-section'>
                        <div className='d-flex column items-center chat-group-info'>
                            <div className='d-flex flex-center chat-group-avatar'>
                                <IoPeopleOutline />
                            </div>
                            <Title className='font-size-3 chat-group-name'>{chat.groupName}</Title>
                            {chat.groupDescription && <Paragraph className='chat-group-description'>{chat.groupDescription}</Paragraph>}
                            <Paragraph className='chat-group-members-count'>{chat.participants.length} members</Paragraph>
                        </div>
                    </div>
                ) : (
                    <div className='chat-details-section'>
                        <div className='d-flex column items-center chat-details-user-info'>
                            <div className='d-flex flex-center chat-details-avatar'>
                                {currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                            </div>
                            <Title className='font-size-2-5 chat-details-name'>
                                {currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                            </Title>
                            <div className='d-flex items-center gap-05 content-center chat-details-status'>
                                {presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                            </div>
                        </div>
                    </div>
                )}

                {chat && !isLoading && (
                    <div className='chat-details-section'>
                        <Title className='font-size-2-5 chat-details-section-title'>Actions</Title>
                        <div className='d-flex column gap-075 chat-details-actions'>
                            <Button variant='ghost' intent='neutral' leftIcon={<IoCallOutline />} block className='content-start'>
                                Voice Call
                            </Button>
                            <Button variant='ghost' intent='neutral' leftIcon={<IoVideocamOutline />} block className='content-start'>
                                Video Call
                            </Button>
                            {chat.isGroup ? (
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    leftIcon={<IoPeopleOutline />}
                                    block
                                    className='content-start'
                                    commandfor='group-management-modal'
                                    command='showModal'
                                >
                                    Manage Group
                                </Button>
                            ) : (
                                <Button variant='ghost' intent='neutral' leftIcon={<IoInformationCircleOutline />} block className='content-start'>
                                    View Profile
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {chat && !isLoading && (
                    <div className='chat-details-section'>
                        <Title className='font-size-2-5 chat-details-section-title'>Shared Files</Title>
                        {chat && <SharedFilesList currentChatId={chat._id} messages={messages} />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailsPanel;
