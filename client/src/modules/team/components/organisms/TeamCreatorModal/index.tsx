import React, { useState } from 'react';
import Modal from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCreateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/use-team-store';
import { teamCreatorSchema, type TeamCreatorForm } from './validation-schema';
import ApiError from '@/shared/errors/ApiError';
import './TeamCreatorModal.css';

const MODAL_ID = 'team-creator-modal';

interface TeamCreatorModalProps {
    isRequired?: boolean;
    onSuccess?: () => void;
    onClose?: () => void;
}

const TeamCreatorModal: React.FC<TeamCreatorModalProps> = ({
    isRequired = false,
    onSuccess,
    onClose
}) => {
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
                {
                    loading: { title: 'Creating team...' },
                    success: { title: 'Team created successfully' },
                    error: { title: 'Failed to create team' }
                }
            );
            setSelectedTeamId(team._id);
            modalForm.close();
            onSuccess?.();
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) {
                const message = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to perform this action.';
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
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className='d-flex column gap-1-5 p-1-5'>
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

                <Container className='d-flex content-end gap-05 mt-1'>
                    {!isRequired && (
                        <Button
                            variant='ghost'
                            intent='neutral'
                            type='button'
                            onClick={handleClose}
                            disabled={form.formState.isSubmitting}
                        >
                            Cancel
                        </Button>
                    )}

                    <Button
                        type='submit'
                        variant='solid'
                        intent='brand'
                        isLoading={form.formState.isSubmitting}
                        disabled={!nameValue.trim() || form.formState.isSubmitting}
                    >
                        Create Team
                    </Button>
                </Container>
            </form>
        </Modal>
    );
};

export default TeamCreatorModal;
