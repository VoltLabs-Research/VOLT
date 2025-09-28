import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';
import DraggableBinaryContainer from '@/components/organisms/DraggableBinaryContainer';
import TeamCreatorBg from '@/assets/images/create-new-team.webp';

const AddMembersModal = () => {
    const { teamMembers, currentChat, addUsersToGroup } = useChat();
    const user = useAuthStore((store) => store.user);
    
    const {
        selectedMembers,
        setShowAddMembers,
        setSelectedMembers,
        toggleMemberSelection
    } = useChatStore();

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0 || !currentChat) return;
        
        try {
            await addUsersToGroup(currentChat._id, selectedMembers);
            setShowAddMembers(false);
            setSelectedMembers([]);
        } catch (error) {
            console.error('Failed to add members:', error);
        }
    };  

    return (
        <DraggableBinaryContainer
            title='Add new members'
            description="You can add new members who are in the teams you are part of."
            bg={TeamCreatorBg}
            onClose={() => setShowAddMembers(false)}
        >
            <div className='chat-group-management-content'>
                <div className='chat-group-management-body'>
                    <div className='chat-create-group-members'>
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
                            onClick={() => setShowAddMembers(false)}
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
        </DraggableBinaryContainer>
    );
};

export default AddMembersModal;