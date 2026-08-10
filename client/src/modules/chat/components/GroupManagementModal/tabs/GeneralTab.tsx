import { Alert, AlertContent, AlertDescription, AlertTitle, Button } from '@heroui/react';
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

/*
 * bravais's `Callout` in its stacked form: `role='region'`, an `aria-label` taken
 * from the title, and the action button to the right of the copy. HeroUI's `Alert`
 * is that layout, so only the role and label have to be restated — Alert sets
 * neither, and this one is a landmark rather than a live region.
 *
 * The action was `variant='outline' intent='danger'`, which §4d resolves to a ghost
 * button carrying the danger hue rather than to `danger`'s filled version.
 */
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
                    variant='primary'
                    onPress={onSave}
                    isPending={isLoading}
                    isDisabled={!groupName.trim()}
                >
                    Save Changes
                </Button>
            </div>
        )}

        <Alert status='danger' role='region' aria-label='Leave Group'>
            <AlertContent>
                <AlertTitle<'h2'> render={(props) => <h2 {...props} />}>
                    Leave Group
                </AlertTitle>
                <AlertDescription>
                    You will no longer be able to see messages in this group.
                </AlertDescription>
            </AlertContent>

            <Button variant='ghost' size='sm' className='text-danger' onPress={onLeave}>
                <LogOut />
                Leave Group
            </Button>
        </Alert>
    </div>
);

export default GeneralTab;
