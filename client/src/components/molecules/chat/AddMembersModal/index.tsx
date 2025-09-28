import { useChat } from '@/hooks/chat/useChat';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';

const AddMembersModal = ({ 
    toggle,
    toggleMemberSelection,
    selectedMembers,
    handleAddMembers
}) => {
    const { teamMembers, currentChat } = useChat();
    const user = useAuthStore((store) => store.user);

    return (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Add Members</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={() => toggle(false)}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                <div className='chat-group-management-body'>
                    <div className='chat-create-group-members'>
                        <h5>Select Members to Add</h5>
                        {teamMembers
                            .filter((member, index, self) => 
                                member._id !== user?._id && 
                                !currentChat?.participants.some(p => p._id === member._id) &&
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
                    <div className='chat-group-management-actions'>
                        <button 
                            className='chat-group-management-cancel'
                            onClick={() => toggle(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            className='chat-group-management-add'
                            onClick={handleAddMembers}
                            disabled={selectedMembers.length === 0}
                        >
                            Add Members
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddMembersModal;