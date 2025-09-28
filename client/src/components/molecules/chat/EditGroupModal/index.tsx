import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import DraggableBinaryContainer from '@/components/organisms/DraggableBinaryContainer';
import TeamCreatorBg from '@/assets/images/create-new-team.webp';

const EditGroupModal = () => {
    const { currentChat, updateGroupInfo } = useChat();
    
    const {
        editGroupName,
        editGroupDescription,
        setShowEditGroup,
        setEditGroupName,
        setEditGroupDescription
    } = useChatStore();

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
        <DraggableBinaryContainer
            title='Edit Group'
            description="Update your group name and description."
            bg={TeamCreatorBg}
            onClose={() => setShowEditGroup(false)}
        >
            <div className='chat-edit-group-content'>
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
        </DraggableBinaryContainer>
    );
};

export default EditGroupModal;