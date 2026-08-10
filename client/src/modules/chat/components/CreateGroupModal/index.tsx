import TeamMemberList from '../TeamMemberList';
import { useState } from 'react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal, closeModal } from '@/shared/ui/modal';
import { toggleSelection } from '@/shared/utils/selection';
import type { User } from '@volt/contracts/modules/auth/domain';

/* Shared so ChatSidebar's trigger and this modal cannot drift apart. The id used
   to be a bare string in both places, which was survivable only while the native
   <dialog> matched them up by `commandfor` at runtime. */
export const CREATE_GROUP_MODAL_ID = 'create-group-modal';

interface CreateGroupModalProps {
    teamMembers: User[];
    currentUserId?: string;
    onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<void>;
}

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
            id={CREATE_GROUP_MODAL_ID}
            title='Create New Group'
            description='Create a group chat with your team members'
            width='500px'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onPress: () => closeModal(CREATE_GROUP_MODAL_ID)
                    }}
                    primary={{
                        label: 'Create Group',
                        onPress: handleCreate,
                        isDisabled: !groupName.trim() || selectedMembers.length === 0,
                        isPending: isLoading
                    }}
                />
            )}
        >
            <div className='flex flex-col gap-4 p-8'>
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

                <div className='flex flex-col gap-2'>
                    <p className='text-sm font-semibold text-muted'>
                        Select Members ({selectedMembers.length} selected)
                    </p>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={selectedMembers}
                        currentUserId={currentUserId}
                        onToggle={handleToggleMember}
                    />
                </div>

            </div>
        </Modal>
    );
};

export default CreateGroupModal;
