import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chat';
import {
    IoCloseOutline,
    IoCheckmarkOutline,
    IoSearchOutline
} from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './AddMembersModal.css';

const AddMembersModal = () => {
    const {
        currentChat,
        teamMembers,
        selectedMembers,
        setShowAddMembers,
        setSelectedMembers,
        toggleMemberSelection,
        addUsersToGroup,
        loadTeamMembers
    } = useChatStore();
    const user = useAuthStore((store) => store.user);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Load team members when modal opens
    useEffect(() => {
        if (currentChat?.team?._id) {
            loadTeamMembers(currentChat.team._id);
        }
    }, [currentChat, loadTeamMembers]);

    // Filter out members who are already in the group
    const availableMembers = teamMembers.filter(member =>
        !currentChat?.participants.some(participant => participant._id === member._id) &&
        member._id !== user?._id
    );

    // Filter members based on search query
    const filteredMembers = availableMembers.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0) return;

        setIsLoading(true);
        try {
            await addUsersToGroup(currentChat!._id, selectedMembers);
            setSelectedMembers([]);
            setShowAddMembers(false);
        } catch (error) {
            console.error('Failed to add members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedMembers([]);
        setShowAddMembers(false);
    };

    if (!currentChat || !currentChat.isGroup) return null;

    return (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <Title className='font-size-3'>Add Members</Title>
                    <button
                        className='chat-close-modal'
                        onClick={handleClose}
                    >
                        <IoCloseOutline />
                    </button>
                </div>

                <div className='chat-group-management-body'>
                    {/* Search */}
                    <div className='chat-add-members-search'>
                        <div className='chat-add-members-search-container'>
                            <IoSearchOutline className='chat-add-members-search-icon' />
                            <input
                                type='text'
                                placeholder='Search team members...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='chat-add-members-search-input'
                            />
                        </div>
                    </div>

                    {/* Available Members */}
                    <div className='chat-add-members-list'>
                        <Title className='font-size-2-5'>Available Members</Title>
                        {filteredMembers.length === 0 ? (
                            <div className='chat-add-members-empty'>
                                <Paragraph>No available members to add</Paragraph>
                            </div>
                        ) : (
                            <div className='chat-add-members-members'>
                                {filteredMembers.map((member) => {
                                    const isSelected = selectedMembers.includes(member._id);

                                    return (
                                        <div
                                            key={member._id}
                                            className={`chat-add-members-member ${isSelected ? 'selected' : ''}`}
                                            onClick={() => toggleMemberSelection(member._id)}
                                        >
                                            <div className='chat-add-members-member-avatar'>
                                                {getInitials(member.firstName, member.lastName)}
                                            </div>
                                            <div className='chat-add-members-member-info'>
                                                <span className='chat-add-members-member-name'>
                                                    {member.firstName} {member.lastName}
                                                </span>
                                                <span className='chat-add-members-member-email'>
                                                    {member.email}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <div className='chat-add-members-member-check'>
                                                    <IoCheckmarkOutline />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Members Summary */}
                    {selectedMembers.length > 0 && (
                        <div className='chat-add-members-selected'>
                            <Paragraph>{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected</Paragraph>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='chat-group-management-actions'>
                        <button
                            className='chat-group-management-cancel'
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            className='chat-group-management-add'
                            onClick={handleAddMembers}
                            disabled={selectedMembers.length === 0 || isLoading}
                        >
                            {isLoading ? 'Adding...' : `Add ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddMembersModal;
