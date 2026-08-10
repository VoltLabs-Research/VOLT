import { Button, Callout } from '@voltstack/bravais';
import { LogOut } from 'lucide-react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';

interface GeneralTabProps {
    groupName: string;
    groupDescription: string;
    isLoading: boolean;
    canEdit: boolean;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onSave: () => void;
    onLeave: () => void;
}

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
    <div className='flex flex-col gap-4'>
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
            <div className='flex justify-end'>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onSave}
                    isLoading={isLoading}
                    disabled={!groupName.trim()}
                >
                    Save Changes
                </Button>
            </div>
        )}

        <Callout
            tone='danger'
            title='Leave Group'
            description='You will no longer be able to see messages in this group.'
            action={{
                label: 'Leave Group',
                icon: <LogOut />,
                onClick: onLeave
            }}
        />
    </div>
);

export default GeneralTab;
