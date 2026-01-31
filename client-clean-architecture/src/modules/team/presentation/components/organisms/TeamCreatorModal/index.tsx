import React, { useState } from 'react';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import useForm from '@/shared/presentation/hooks/use-form';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { teamCreatorSchema, TeamCreatorForm } from './validation-schema';
import './TeamCreatorModal.css';

const MODAL_ID = 'team-creator-modal';

interface TeamCreatorModalProps {
    isRequired?: boolean;
    onSuccess?: () => void;
    onClose?: () => void;
};

const TeamCreatorModal: React.FC<TeamCreatorModalProps> = ({
    isRequired = false,
    onSuccess,
    onClose
}) => {
    const [apiError, setApiError] = useState<string | null>(null);

    const { createTeamUseCase } = useTeamUseCases();
    const addTeam = useTeamStore((state) => state.addTeam);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);

    const { field, values, handleSubmit, isSubmitting, reset } = useForm<TeamCreatorForm>({
        initialValues: {
            name: '',
            description: ''
        },
        schema: teamCreatorSchema,
        onSubmit: async (data) => {
            setApiError(null);
            try{
                const team = await createTeamUseCase.execute({
                    name: data.name.trim(),
                    description: data.description.trim() || undefined
                });
                addTeam(team);
                setSelectedTeam(team);
                reset();
                closeModal(MODAL_ID);
                onSuccess?.();
            }catch(err: any){
                setApiError(err?.message || 'Failed to create team');
                throw err;
            }
        }
    });

    const handleClose = () => {
        if(isRequired) return;
        closeModal(MODAL_ID);
        onClose?.();
    };

    const nameField = field('name');
    const descriptionField = field('description');

    return (
        <Modal
            id={MODAL_ID}
            title='Create Team'
            description='Create a new workspace for your trajectories.'
            width='450px'
        >
            <form onSubmit={handleSubmit()} className='d-flex column gap-1-5 p-1-5'>
                <FormField
                    label='Team Name'
                    value={nameField.value}
                    onChange={nameField.onChange}
                    onBlur={nameField.onBlur}
                    placeholder='Ex. My Research Group'
                    required
                    disabled={isSubmitting}
                    error={nameField.error}
                    autoFocus
                />

                <FormField
                    label='Description (Optional)'
                    value={descriptionField.value}
                    onChange={descriptionField.onChange}
                    onBlur={descriptionField.onBlur}
                    placeholder='What is this team for?'
                    disabled={isSubmitting}
                    error={descriptionField.error}
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
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                    )}

                    <Button
                        type='submit'
                        variant='solid'
                        intent='brand'
                        isLoading={isSubmitting}
                        disabled={!values.name.trim() || isSubmitting}
                    >
                        Create Team
                    </Button>
                </Container>
            </form>
        </Modal>
    );
};

export default TeamCreatorModal;

export const openTeamCreatorModal = () => {
    (document.getElementById(MODAL_ID) as HTMLDialogElement)?.showModal();
};
