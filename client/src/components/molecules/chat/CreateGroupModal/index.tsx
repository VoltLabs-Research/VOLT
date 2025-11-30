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
import { useFormValidation } from '@/hooks/useFormValidation';
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

    const { errors, validate, checkField } = useFormValidation({
        groupName: { required: true, minLength: 3, maxLength: 50, message: 'Group name must be between 3 and 50 characters' },
        groupDescription: { maxLength: 250, message: 'Description cannot exceed 250 characters' }
    });

    const handleCreateGroup = async () => {
        if (!validate({ groupName, groupDescription })) return;
        if (selectedMembers.length === 0 || !selectedTeam) return; // Kept original validation

        setIsLoading(true);
        try {
            await createGroupChat( // Changed from createGroup to createGroupChat to match existing hook usage
                selectedTeam._id, // Kept selectedTeam._id as it was in the original createGroupChat call
                groupName.trim(),
                groupDescription.trim(),
                selectedMembers
            );
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
            setShowCreateGroup(false);
        } catch (error) {
            console.error('Failed to create group:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGroupName(e.target.value);
        checkField('groupName', e.target.value);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGroupDescription(e.target.value);
        checkField('groupDescription', e.target.value);
    };

    return (
        <DraggableBinaryContainer
            title='Create New Group'
            description="Create a new group chat with your team members."
            bg={CreateGroupBg}
            handleSubmit={handleCreateGroup}
            onClose={() => setShowCreateGroup(false)}
        >
            <div className="space-y-4">
                <div>
                    <FormInput
                        label='Group Name'
                        value={groupName}
                        onChange={handleNameChange}
                        placeholder='Enter group name'
                        required
                        error={errors.groupName}
                    />
                </div>

                <div>
                    <FormInput
                        label='Group Description'
                        value={groupDescription}
                        onChange={handleDescriptionChange}
                        placeholder='Enter group description (optional)'
                        error={errors.groupDescription}
                    />
                </div>
            </div>

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