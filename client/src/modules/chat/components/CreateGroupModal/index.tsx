import TeamMemberList from '../TeamMemberList';
import { useState } from 'react';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Stack, Text, Modal } from '@/shared/presentation/primitives';
import { toggleSelection } from '@/shared/utils/selection';
import type { User } from '@/modules/auth/api/entities/user';

interface CreateGroupModalProps {
    teamMembers: User[];
    currentUserId?: string;
    onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<void>;
};

const CreateGroupModal = ({ teamMembers, currentUserId, onCreateGroup }: CreateGroupModalProps) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleToggleMember = (memberId: string) => {
        setSelectedMembers((prev) => toggleSelection(prev, memberId));
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;

        setIsLoading(true);

        try {
            await onCreateGroup(groupName.trim(), groupDescription.trim(), selectedMembers);
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
        } catch {
            // The caller already handles user-facing failures.
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            id='create-group-modal'
            title='Create New Group'
            description='Create a group chat with your team members'
            width='500px'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        commandfor: 'create-group-modal',
                        command: 'close'
                    }}
                    primary={{
                        label: 'Create Group',
                        onClick: handleCreate,
                        disabled: !groupName.trim() || selectedMembers.length === 0,
                        isLoading: isLoading
                    }}
                />
            )}
        >
            <Stack gap='1' p='2'>
                <FormFieldRHF
                    label='Group Name'
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder='Enter group name'
                />

                <FormFieldRHF
                    label='Description'
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder='Enter description (optional)'
                />

                <Stack gap='05'>
                    <Text as='p' size='md' weight='bold' tone='secondary'>
                        Select Members ({selectedMembers.length} selected)
                    </Text>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={selectedMembers}
                        currentUserId={currentUserId}
                        onToggle={handleToggleMember}
                    />
                </Stack>

            </Stack>
        </Modal>
    );
};

export default CreateGroupModal;
