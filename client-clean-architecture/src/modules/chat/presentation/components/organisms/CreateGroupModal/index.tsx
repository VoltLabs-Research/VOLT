import { useState } from 'react';
import type { User } from '@/modules/auth/domain/entities';
import Modal from '@/shared/presentation/components/Modal';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';
import { toggleSelection } from '@/shared/utils/selection';
import { TeamMemberList } from '../../molecules';

interface CreateGroupModalProps {
    teamMembers: User[];
    currentUserId?: string;
    onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<void>;
};

const CreateGroupModal = ({ teamMembers, currentUserId, onCreateGroup }: CreateGroupModalProps) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const { isLoading, execute } = useAsyncAction();

    const handleToggleMember = (memberId: string) => {
        setSelectedMembers((prev) => toggleSelection(prev, memberId));
    };

    const handleCreate = () => execute(async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;

        await onCreateGroup(groupName.trim(), groupDescription.trim(), selectedMembers);
        // Reset form
        setGroupName('');
        setGroupDescription('');
        setSelectedMembers([]);
    });

    return (
        <Modal
            id='create-group-modal'
            title='Create New Group'
            description='Create a group chat with your team members'
            width='500px'
        >
            <Container className='d-flex column gap-1 p-2'>
                <FormField
                    label='Group Name'
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder='Enter group name'
                    required
                />

                <FormField
                    label='Description'
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder='Enter description (optional)'
                />

                <Container className='d-flex column gap-05'>
                    <Paragraph className='font-size-2 font-weight-6 color-secondary'>
                        Select Members ({selectedMembers.length} selected)
                    </Paragraph>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={selectedMembers}
                        currentUserId={currentUserId}
                        onToggle={handleToggleMember}
                    />
                </Container>

                <Container className='d-flex content-end gap-05 mt-1'>
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
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedMembers.length === 0}
                        isLoading={isLoading}
                    >
                        Create Group
                    </Button>
                </Container>
            </Container>
        </Modal>
    );
};

export default CreateGroupModal;
