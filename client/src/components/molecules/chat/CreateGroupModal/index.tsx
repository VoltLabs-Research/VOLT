import { useState } from 'react';
import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/slices/chat';
import { useTeamStore } from '@/features/team/stores';
import { IoCheckmarkOutline } from 'react-icons/io5';
import { useAuthStore } from '@/features/auth/stores';
import Modal from '@/components/molecules/common/Modal';
import Button from '@/components/primitives/Button';
import FormInput from '@/components/atoms/form/FormInput';
import { useFormValidation } from '@/hooks/useFormValidation';
import './CreateGroupModal.css';
import Title from '@/components/primitives/Title';
import Container from '@/components/primitives/Container';

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

    const [isLoading, setIsLoading] = useState(false);

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
        <Modal
            id='create-group-modal'
            title='Create New Group'
            description="Create a new group chat with your team members."
            width='500px'
        >
            <Container className='p-2'>
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
                            placeholder='Enter group description(optional)'
                            error={errors.groupDescription}
                        />
                    </div>
                </div>

                <div className='d-flex column gap-1 create-group-members-section mt-1 w-max'>
                    <Title className='font-size-2-5'>Select Members</Title>
                    <div className='d-flex column gap-05 create-group-members-list y-auto'>
                        {teamMembers
                            .filter((member, index, self) =>
                                member._id !== user?._id &&
                                self.findIndex(m => m._id === member._id) === index
                            )
                            .map((member) => (
                                <div
                                    key={member._id}
                                    className={`d-flex items-center gap-075 create-group-member ${selectedMembers.includes(member._id) ? 'selected' : ''} cursor-pointer`}
                                    onClick={() => toggleMemberSelection(member._id)}
                                >
                                    <div className='d-flex flex-center create-group-member-avatar font-weight-6 overflow-hidden'>
                                        <img src={member.avatar} alt="" className='w-max h-max object-cover' />
                                    </div>
                                    <div className='create-group-member-info flex-1'>
                                        <span className='create-group-member-name font-weight-5 color-primary'>
                                            {member.firstName} {member.lastName}
                                        </span>
                                    </div>
                                    {selectedMembers.includes(member._id) && (
                                        <IoCheckmarkOutline className='d-flex flex-center create-group-member-check' />
                                    )}
                                </div>
                            ))}
                    </div>
                </div>

                <div className='d-flex content-end gap-05 mt-1'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        commandfor='create-group-modal'
                        command='close'
                    >
                        Cancel
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        disabled={!groupName.trim() || selectedMembers.length === 0 || isLoading}
                        onClick={handleCreateGroup}
                        isLoading={isLoading}
                    >
                        Create Group
                    </Button>
                </div>
            </Container>
        </Modal>
    );
};

export default CreateGroupModal;
