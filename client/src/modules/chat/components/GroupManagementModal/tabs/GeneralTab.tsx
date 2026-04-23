import { Stack, Box, Button } from '@/shared/presentation/primitives';
import DangerZone from '@/shared/presentation/components/DangerZone';
import { IoExitOutline } from 'react-icons/io5';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import type { Chat } from '@/modules/chat/api/entities/chat';

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
    <Stack gap='1'>
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
            <Box display='flex' justify='end'>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onSave}
                    isLoading={isLoading}
                    disabled={!groupName.trim()}
                >
                    Save Changes
                </Button>
            </Box>
        )}

        <DangerZone
            title='Leave Group'
            description='You will no longer be able to see messages in this group.'
            actionLabel='Leave Group'
            actionIcon={<IoExitOutline />}
            onAction={onLeave}
        />
    </Stack>
);

export default GeneralTab;
