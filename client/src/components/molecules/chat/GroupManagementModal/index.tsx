import { IoAddOutline, IoCloseOutline, IoCreateOutline, IoPersonRemoveOutline, IoShieldOutline, IoTrashOutline } from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';

const GroupManagementModal = ({
    setShowGroupManagement,
    handleManageAdmins,
    openAddMembers,
    openEditGroup
}) => {
    const { currentChat, removeUsersFromGroup, leaveGroup } = useChat();
    const user = useAuthStore((store) => store.user);

    const handleRemoveMember = async (memberId: string) => {
        if (!currentChat) return;
        
        try {
            await removeUsersFromGroup(currentChat._id, [memberId]);
        } catch (error) {
            console.error('Failed to remove member:', error);
        }
    };

    const handleLeaveGroup = async () => {
        if (!currentChat) return;
        
        try {
            await leaveGroup(currentChat._id);
            setShowGroupManagement(false);
        } catch (error) {
            console.error('Failed to leave group:', error);
        }
    };

    return currentChat && (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Group Management</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={() => setShowGroupManagement(false)}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                <div className='chat-group-management-body'>
                    <div className='chat-group-management-members'>
                        <h5>Group Members</h5>
                        {currentChat.participants
                            .filter((member, index, self) => 
                                self.findIndex(m => m._id === member._id) === index
                            )
                            .map((member) => (
                            <div key={member._id} className='chat-group-management-member'>
                                <div className='chat-group-member-avatar'>
                                    {getInitials(member.firstName, member.lastName)}
                                </div>
                                <div className='chat-group-member-info'>
                                    <span className='chat-group-member-name'>
                                        {member.firstName} {member.lastName}
                                    </span>
                                    {currentChat.admins.some(admin => admin._id === member._id) && (
                                        <span className='chat-admin-badge'>Admin</span>
                                    )}
                                </div>
                                {member._id !== user?._id && (
                                    <button 
                                        className='chat-remove-member'
                                        onClick={() => handleRemoveMember(member._id)}
                                    >
                                        <IoTrashOutline />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className='chat-group-management-actions'>
                        <button 
                            className='chat-group-management-cancel'
                            onClick={() => setShowGroupManagement(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            className='chat-group-management-add'
                            onClick={openAddMembers}
                        >
                            <IoAddOutline /> Add Members
                        </button>
                        {currentChat.admins?.some(admin => admin._id === user?._id) && (
                            <button 
                                className='chat-group-management-add'
                                onClick={handleManageAdmins}
                            >
                                <IoShieldOutline /> Manage Admins
                            </button>
                        )}
                        {currentChat.admins?.some(admin => admin._id === user?._id) && (
                            <button 
                                className='chat-group-management-add'
                                onClick={openEditGroup}
                            >
                                <IoCreateOutline /> Edit Group
                            </button>
                        )}
                        <button 
                            className='chat-leave-group'
                            onClick={handleLeaveGroup}
                        >
                            <IoPersonRemoveOutline /> Leave Group
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupManagementModal;