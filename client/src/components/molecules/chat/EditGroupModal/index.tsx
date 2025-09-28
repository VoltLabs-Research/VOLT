import { useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';

const EditGroupModal = ({
    setShowEditGroup
}) => {
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupDescription, setEditGroupDescription] = useState('');
    const { currentChat, updateGroupInfo } = useChat();

    const handleUpdateGroupInfo = async () => {
        if (!currentChat) return;
        
        try {
            await updateGroupInfo(
                currentChat._id,
                editGroupName.trim() || undefined,
                editGroupDescription.trim() || undefined
            );
            setShowEditGroup(false);
        } catch (error) {
            console.error('Failed to update group info:', error);
        }
    };

    return (
        <div className='chat-edit-group-modal'>
            <div className='chat-edit-group-content'>
                <div className='chat-edit-group-header'>
                    <h3>Edit Group</h3>
                    <button 
                        className='chat-close-modal'
                        onClick={() => setShowEditGroup(false)}
                    >
                        <IoCloseOutline />
                    </button>
                </div>
                <div className='chat-edit-group-body'>
                    <div className='chat-edit-group-form'>
                        <input
                            type='text'
                            className='chat-edit-group-input'
                            placeholder='Group name'
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                        />
                        <textarea
                            className='chat-edit-group-textarea'
                            placeholder='Group description'
                            value={editGroupDescription}
                            onChange={(e) => setEditGroupDescription(e.target.value)}
                        />
                    </div>
                    <div className='chat-edit-group-actions'>
                        <button 
                            className='chat-edit-group-cancel'
                            onClick={() => setShowEditGroup(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            className='chat-edit-group-save'
                            onClick={handleUpdateGroupInfo}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditGroupModal;