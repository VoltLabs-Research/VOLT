import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';

const CreateGroupModal = () => {
    const { teamMembers, createGroupChat, currentChat } = useChat();
    const user = useAuthStore((store) => store.user);
    
    const {
        selectedMembers,
        groupName,
        groupDescription,
        setShowCreateGroup,
        setSelectedMembers,
        setGroupName,
        setGroupDescription,
        toggleMemberSelection
    } = useChatStore();

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        
        try {
            await createGroupChat(
                currentChat?.team._id || '',
                groupName.trim(),
                groupDescription.trim(),
                selectedMembers
            );
            setShowCreateGroup(false);
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    };

    return (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Create New Group</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={() => setShowCreateGroup(false)}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                <div className='chat-group-management-body'>
                    <div className='chat-create-group-container'>
                        <div className='chat-create-group-form'>
                            <input
                                type='text'
                                className='chat-create-group-input'
                                placeholder='Group name'
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            />
                            <textarea
                                className='chat-create-group-textarea'
                                placeholder='Group description (optional)'
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                            />
                        </div>
                        <div className='chat-create-group-members'>
                            <h5>Select Members</h5>
                            {teamMembers
                                .filter((member, index, self) => 
                                    member._id !== user?._id && 
                                    self.findIndex(m => m._id === member._id) === index
                                )
                                .map((member) => (
                                    <div 
                                        key={member._id}
                                        className={`chat-create-group-member ${selectedMembers.includes(member._id) ? 'selected' : ''}`}
                                        onClick={() => toggleMemberSelection(member._id)}
                                    >
                                        <div className='chat-group-member-avatar'>
                                            {getInitials(member.firstName, member.lastName)}
                                        </div>
                                        <div className='chat-group-member-info'>
                                            <span className='chat-group-member-name'>
                                                {member.firstName} {member.lastName}
                                            </span>
                                        </div>
                                        {selectedMembers.includes(member._id) && (
                                            <IoCheckmarkOutline className='chat-member-selected-icon' />
                                        )}
                                    </div>
                                ))}
                        </div>
                        <div className='chat-create-group-actions'>
                            <button 
                                className='chat-create-group-cancel'
                                onClick={() => setShowCreateGroup(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className='chat-create-group-create'
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedMembers.length === 0}
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;