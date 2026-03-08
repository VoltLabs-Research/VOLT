import type { Chat } from '@/modules/chat/api/entities/chat';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import DangerZone from '@/shared/presentation/components/DangerZone';
import { IoExitOutline } from 'react-icons/io5';

interface GeneralTabProps {
    chat: Chat;
    groupName: string;
    groupDescription: string;
    isLoading: boolean;
    canEdit: boolean;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onSave: () => void;
    onLeave: () => void;
};

const GeneralTab = ({
    groupName,
    groupDescription,
    isLoading,
    canEdit,
    onNameChange,
    onDescriptionChange,
    onSave,
    onLeave
}: GeneralTabProps) => (
    <Container className='d-flex column gap-1'>
        <FormFieldRHF
            label='Group Name'
            value={groupName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder='Enter group name'
            disabled={!canEdit}
        />
        <FormFieldRHF
            label='Description'
            value={groupDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder='Enter description (optional)'
            disabled={!canEdit}
        />
        {canEdit && (
            <Container className='d-flex content-end'>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onSave}
                    isLoading={isLoading}
                    disabled={!groupName.trim()}
                >
                    Save Changes
                </Button>
            </Container>
        )}

        <DangerZone
            title='Leave Group'
            description='You will no longer be able to see messages in this group.'
            actionLabel='Leave Group'
            actionIcon={<IoExitOutline />}
            onAction={onLeave}
        />
    </Container>
);

export default GeneralTab;
