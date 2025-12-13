import type { Chat, Message, Participant } from '@/types/chat';
import { getInitials } from '@/utilities/guest';
import MessageSkeleton from '@/components/atoms/chat/MessageSkeleton';
import {
    IoChatbubblesOutline,
    IoCallOutline,
    IoVideocamOutline,
    IoPeopleOutline,
    IoInformationCircleOutline } from 'react-icons/io5';
import SharedFilesList from '@/components/molecules/chat/SharedFilesList';

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
    return(
        <div className='chat-details-container'>
            <div className='chat-details-header'>
                <h3 className='chat-details-title'>{chat?.isGroup ? 'Group Info' : 'Contact Info'}</h3>
            </div>
            <div className='chat-details-content'>
                {!chat ? (
                    <div className='chat-no-selection'>
                        <div className='chat-no-selection-icon'>
                            <IoChatbubblesOutline />
                        </div>
                        <h4 className='chat-no-selection-title'>No chat selected</h4>
                        <p className='chat-no-selection-description'>Select a conversation to view details</p>
                    </div>
                ) : isLoading ? (
                    <MessageSkeleton variant='contact' />
                ) : chat.isGroup ? (
                    <div className='chat-details-section'>
                        <div className='chat-group-info'>
                            <div className='chat-group-avatar'>
                                <IoPeopleOutline />
                            </div>
                            <h4 className='chat-group-name'>{chat.groupName}</h4>
                            {chat.groupDescription && <p className='chat-group-description'>{chat.groupDescription}</p>}
                            <p className='chat-group-members-count'>{chat.participants.length} members</p>
                        </div>
                    </div>
                ) : (
                    <div className='chat-details-section'>
                        <div className='chat-details-user-info'>
                            <div className='chat-details-avatar'>
                                {currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                            </div>
                            <h4 className='chat-details-name'>
                             {currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                            </h4>
                            <div className='chat-details-status'>
                                {presence === 'online' ? 'Online' : presence === 'offline' ? 'Offline' : 'Connecting...'}
                            </div>
                        </div>
                    </div>
                )}

                {chat && !isLoading && (
                    <div className='chat-details-section'>
                        <h4 className='chat-details-section-title'>Actions</h4>
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
                        <h4 className='chat-details-section-title'>Shared Files</h4>
                        {chat && <SharedFilesList currentChatId={chat._id} messages={messages} />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailsPanel;
