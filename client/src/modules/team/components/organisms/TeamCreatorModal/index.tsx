import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { getAccessDeniedMessage, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { useState } from 'react';
import { teamCreatorSchema } from './validation-schema';
import type { TeamCreatorForm } from './validation-schema';
import './TeamCreatorModal.css';

const MODAL_ID = 'team-creator-modal';
const TEAM_CREATOR_FORM_ID = 'team-creator-form';

interface TeamCreatorModalProps {
    isRequired?: boolean;
    onSuccess?: () => void;
    onClose?: () => void;
};

interface PromiseToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

const TEAM_CREATOR_TOAST_OPTIONS: PromiseToastOptions = {
    loading: { title: 'Creating team...' },
    success: { title: 'Team created successfully' },
    error: { title: 'Failed to create team' }
};

export const TeamCreatorModal = ({
    isRequired = false,
    onSuccess,
    onClose
}: TeamCreatorModalProps) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const createTeamMutation = useCreateTeamMutation();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);

    const form = useZodForm<TeamCreatorForm>({
        schema: teamCreatorSchema,
        defaultValues: {
            name: '',
            description: ''
        }
    });

    const nameValue = form.watch('name');

    const modalForm = useModalForm({
        modalId: MODAL_ID,
        reset: () => {
            form.reset();
            setApiError(null);
        },
        onAfterClose: onClose
    });

    const onSubmit = async (data: TeamCreatorForm) => {
        setApiError(null);
        try {
            const team = await showPromise(
                createTeamMutation.mutateAsync({
                    name: data.name.trim(),
                    description: data.description?.trim() || ''
                }),
                TEAM_CREATOR_TOAST_OPTIONS
            );
            setSelectedTeamId(team._id);
            modalForm.close();
            onSuccess?.();
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) {
                const message = getAccessDeniedMessage(error, 'You do not have permission to perform this action.')
                    ?? 'You do not have permission to perform this action.';
                setApiError(message);
                return;
            }
            if (error instanceof Error) {
                setApiError(error.message);
            } else {
                setApiError('Failed to create team');
            }
            throw error;
        }
    };

    const handleClose = () => {
        if (isRequired) return;
        modalForm.close();
    };

    return (
        <Modal
            id={MODAL_ID}
            title='Create Team'
            description='Create a new workspace for your trajectories.'
            width='450px'
            footer={(
                <ModalFooterActions
                    secondary={!isRequired ? {
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: form.formState.isSubmitting
                    } : undefined}
                    primary={{
                        label: 'Create Team',
                        type: 'submit',
                        form: TEAM_CREATOR_FORM_ID,
                        isLoading: form.formState.isSubmitting,
                        disabled: !nameValue.trim() || form.formState.isSubmitting
                    }}
                />
            )}
        >
            <form id={TEAM_CREATOR_FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className='d-flex column gap-1-5 p-1-5'>
                <FormFieldRHF
                    name='name'
                    control={form.control}
                    label='Team Name'
                    placeholder='Ex. My Research Group'
                    disabled={form.formState.isSubmitting}
                    autoFocus
                />

                <FormFieldRHF
                    name='description'
                    control={form.control}
                    label='Description (Optional)'
                    placeholder='What is this team for?'
                    disabled={form.formState.isSubmitting}
                />

                {apiError && (
                    <Container className='team-creator-error radius-sm font-size-2'>
                        {apiError}
                    </Container>
                )}
            </form>
        </Modal>
    );
};
