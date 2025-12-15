import type { Chat, Message, Participant } from '@/types/chat';
import { getInitials } from '@/utilities/guest';
import MessageSkeleton from '@/components/atoms/chat/MessageSkeleton';
import { IoChatbubblesOutline, IoCallOutline, IoVideocamOutline, IoPeopleOutline, IoInformationCircleOutline } from 'react-icons/io5';
import SharedFilesList from '@/components/molecules/chat/SharedFilesList';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
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
        <div className='chat-details-container'>
            <div className='chat-details-header'>
                <Title className='chat-details-title'>{chat?.isGroup ? 'Group Info' : 'Contact Info'}</Title>
            </div>
            <div className='chat-details-content'>
                {!chat ? (
                    <div className='chat-no-selection'>
                        <div className='chat-no-selection-icon'>
                            <IoChatbubblesOutline />
                        </div>
                        <Title className='font-size-3 chat-no-selection-title'>No chat selected</Title>
                        <Paragraph className='chat-no-selection-description'>Select a conversation to view details</Paragraph>
                    </div>
                ) : isLoading ? (
                    <MessageSkeleton variant='contact' />
                ) : chat.isGroup ? (
                    <div className='chat-details-section'>
                        <div className='chat-group-info'>
                            <div className='chat-group-avatar'>
                                <IoPeopleOutline />
                            </div>
                            <Title className='font-size-3 chat-group-name'>{chat.groupName}</Title>
                            {chat.groupDescription && <Paragraph className='chat-group-description'>{chat.groupDescription}</Paragraph>}
                            <Paragraph className='chat-group-members-count'>{chat.participants.length} members</Paragraph>
                        </div>
                    </div>
                ) : (
                    <div className='chat-details-section'>
                        <div className='chat-details-user-info'>
                            <div className='chat-details-avatar'>
                                {currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                            </div>
                            <Title className='font-size-2-5 chat-details-name'>
                                {currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                            </Title>
                            <div className='chat-details-status'>
                                {presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                            </div>
                        </div>
                    </div>
                )}

                {chat && !isLoading && (
                    <div className='chat-details-section'>
                        <Title className='font-size-2-5 chat-details-section-title'>Actions</Title>
                        <div className='chat-details-actions'>
                            <button className='chat-details-action'>
                                <i className='chat-details-action-icon'>
                                    <IoCallOutline />
                                </i>
                                <span className='chat-details-action-text'>Voice Call</span>
                            </button>
                            <button className='chat-details-action'>
                                <i className='chat-details-action-icon'>
                                    <IoVideocamOutline />
                                </i>
                                <span className='chat-details-action-text'>Video Call</span>
                            </button>
                            {chat.isGroup ? (
                                <button className='chat-details-action' onClick={onOpenGroupManagement}>
                                    <i className='chat-details-action-icon'>
                                        <IoPeopleOutline />
                                    </i>
                                    <span className='chat-details-action-text'>Manage Group</span>
                                </button>
                            ) : (
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoInformationCircleOutline />
                                    </i>
                                    <span className='chat-details-action-text'>View Profile</span>
                                </button>
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
