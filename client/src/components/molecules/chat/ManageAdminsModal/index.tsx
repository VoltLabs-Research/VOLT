import { useChat } from '@/hooks/chat/useChat';
import { IoCheckmarkOutline, IoCloseOutline, IoTrashOutline } from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';

const ManageAdminsModal = ({
    handleRemoveAdmin,
    toggleAdminSelection,
    selectedAdmins,
    handleAddAdmins,
    toggle
}) => {
    const { currentChat } = useChat();
    const user = useAuthStore((store) => store.user);

    return currentChat && (
        <div className='chat-group-management-modal'>
            <div className='chat-group-management-content'>
                <div className='chat-group-management-header'>
                    <h3>Manage Admins</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={() => toggle(false)}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                <div className='chat-group-management-body'>
                    <div className='chat-create-group-members'>
                        <h5>Current Admins</h5>
                        {currentChat.admins?.length > 0 ? (
                            currentChat.admins.map((admin) => (
                                <div key={admin._id} className='chat-group-member-item'>
                                    <div className='chat-group-member-avatar'>
                                        {getInitials(admin.firstName, admin.lastName)}
                                    </div>
                                    <div className='chat-group-member-info'>
                                        <div className='chat-group-member-name'>
                                            {admin.firstName || 'Unknown'} {admin.lastName || ''}
                                        </div>
                                        <div className='chat-group-member-role'>Admin</div>
                                    </div>
                                    {currentChat.admins?.length > 1 && (
                                        <button 
                                            className='chat-group-member-remove'
                                            onClick={() => handleRemoveAdmin(admin._id)}
                                        >
                                            <IoTrashOutline />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className='chat-no-admins'>
                                <p>No admins found</p>
                            </div>
                        )}
                    </div>
                    
                    {currentChat.admins?.some(admin => admin._id === user?._id) && (
                        <div className='chat-create-group-members'>
                            <h5>Add New Admins</h5>
                            {currentChat.participants
                                .filter(member => 
                                    member._id !== user?._id && 
                                    !currentChat.admins?.some(admin => admin._id === member._id)
                                )
                                .map((member) => (
                                    <div 
                                        key={member._id}
                                        className={`chat-create-group-member ${selectedAdmins.includes(member._id) ? 'selected' : ''}`}
                                        onClick={() => toggleAdminSelection(member._id)}
                                    >
                                        <div className='chat-group-member-avatar'>
                                            {getInitials(member.firstName, member.lastName)}
                                        </div>
                                        <div className='chat-group-member-info'>
                                            <div className='chat-group-member-name'>
                                                {member.firstName} {member.lastName}
                                            </div>
                                        </div>
                                        {selectedAdmins.includes(member._id) && (
                                            <IoCheckmarkOutline className='chat-group-member-check' />
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                    
                    <div className='chat-group-management-actions'>
                        <button 
                            className='chat-group-management-cancel'
                            onClick={() => toggle(false)}
                        >
                            Cancel
                        </button>
                        {currentChat.admins?.some(admin => admin._id === user?._id) && (
                            <button 
                                className='chat-group-management-add'
                                onClick={handleAddAdmins}
                                disabled={selectedAdmins.length === 0}
                            >
                                Add Admins
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageAdminsModal;