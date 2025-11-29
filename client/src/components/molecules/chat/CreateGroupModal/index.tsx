import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import useTeamStore from '@/stores/team/team';
import { IoCheckmarkOutline } from 'react-icons/io5';
import { getInitials } from '@/utilities/guest';
import useAuthStore from '@/stores/authentication';
import DraggableBinaryContainer from '@/components/organisms/common/DraggableBinaryContainer';
import Button from '@/components/atoms/common/Button';
import FormInput from '@/components/atoms/form/FormInput';
import CreateGroupBg from '@/assets/images/create-new-group.webp';
import './CreateGroupModal.css';

const CreateGroupModal = () => {
    const { teamMembers, createGroupChat } = useChat();
    const user = useAuthStore((store) => store.user);
    const { selectedTeam } = useTeamStore();
    
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

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMembers.length === 0 || !selectedTeam) return;
        
        try {
            await createGroupChat(
                selectedTeam._id,
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
        <DraggableBinaryContainer
            title='Create New Group'
            description="Create a new group chat with your team members."
            bg={CreateGroupBg}
            handleSubmit={handleCreateGroup}
            onClose={() => setShowCreateGroup(false)}
        >
            <FormInput
                label='Group Name'
                value={groupName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupName(e.target.value)}
                placeholder='Enter group name'
                required
            />
            
            <FormInput
                label='Group Description'
                value={groupDescription}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupDescription(e.target.value)}
                placeholder='Enter group description (optional)'
            />

            <div className='create-group-members-section'>
                <h5>Select Members</h5>
                <div className='create-group-members-list'>
                    {teamMembers
                        .filter((member, index, self) => 
                            member._id !== user?._id && 
                            self.findIndex(m => m._id === member._id) === index
                        )
                        .map((member) => (
                            <div 
                                key={member._id}
                                className={`create-group-member ${selectedMembers.includes(member._id) ? 'selected' : ''}`}
                                onClick={() => toggleMemberSelection(member._id)}
                            >
                                <div className='create-group-member-avatar'>
                                    {getInitials(member.firstName, member.lastName)}
                                </div>
                                <div className='create-group-member-info'>
                                    <span className='create-group-member-name'>
                                        {member.firstName} {member.lastName}
                                    </span>
                                </div>
                                {selectedMembers.includes(member._id) && (
                                    <IoCheckmarkOutline className='create-group-member-check' />
                                )}
                            </div>
                        ))}
                </div>
            </div>

            <Button
                type='submit'
                className='black-on-light sm'
                title='Create Group'
                disabled={!groupName.trim() || selectedMembers.length === 0}
            >
                Create Group
            </Button>
        </DraggableBinaryContainer>
    );
};

export default CreateGroupModal;