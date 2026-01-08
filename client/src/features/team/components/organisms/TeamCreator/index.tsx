import React, { useState } from 'react';
import FormInput from '@/components/atoms/form/FormInput';

import Button from '@/components/primitives/Button';
import { useTeamStore } from '@/features/team/stores';
import Loader from '@/components/atoms/common/Loader';
import { useUIStore } from '@/stores/slices/ui';
import useToast from '@/hooks/ui/use-toast';
import Modal from '@/components/molecules/common/Modal';
import { useFormValidation } from '@/hooks/useFormValidation';
import './TeamCreator.css';
import Container from '@/components/primitives/Container';

interface TeamCreatorProps {
    onClose?: () => void;
    isRequired?: boolean;
}

const TeamCreator: React.FC<TeamCreatorProps> = ({ onClose, isRequired = false }) => {
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toggleTeamCreator = useUIStore((state) => state.toggleTeamCreator);
    const { showError } = useToast();

    const { createTeam, isLoading, error, clearError } = useTeamStore();

    const { errors, validate, checkField, clearError: clearValidationError } = useFormValidation({
        teamName: {
            required: true,
            minLength: 3,
            maxLength: 50,
            message: 'Team name must be between 3 and 50 characters'
        },
        teamDescription: {
            maxLength: 250,
            message: 'Description cannot exceed 250 characters'
        }
    });

    const handleClose = () => {
        if (isRequired) {
            showError('You must create a team to continue.');
            return;
        }
        toggleTeamCreator();
        onClose?.();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate({ teamName, teamDescription })) {
            return;
        }

        setIsSubmitting(true);
        clearError();

        try {
            await createTeam({
                name: teamName.trim(),
                description: teamDescription.trim() || undefined
            });

            setTeamName('');
            setTeamDescription('');
            onClose?.();
        } catch (err) {
            console.error('Failed to create team:', err);
        } finally {
            setIsSubmitting(false);
            toggleTeamCreator();
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamName(e.target.value);
        if (error) clearError();
        checkField('teamName', e.target.value);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamDescription(e.target.value);
        checkField('teamDescription', e.target.value);
    };

    return (
        <Modal
            id='team-creator-modal'
            title='Create Team'
            description="Create a new workspace for your trajectories."
            width="450px"
        >
            <form onSubmit={handleSubmit} className='d-flex column gap-1-5 p-1'>
                <FormInput
                    label='Team Name'
                    value={teamName}
                    onChange={handleNameChange}
                    placeholder='Ex. My Research Group'
                    required
                    disabled={isLoading || isSubmitting}
                    error={errors.teamName}
                />

                <FormInput
                    label='Description (Optional)'
                    value={teamDescription}
                    onChange={handleDescriptionChange}
                    placeholder='What is this team for?'
                    disabled={isLoading || isSubmitting}
                    error={errors.teamDescription}
                />

                <Container className='d-flex content-end gap-05 mt-1'>
                    {!isRequired && (
                        <Button
                            variant='ghost'
                            intent='neutral'
                            commandfor='team-creator-modal'
                            command='close'
                        >
                            Cancel
                        </Button>
                    )}

                    <Button
                        type='submit'
                        variant='solid'
                        intent='brand'
                        isLoading={isLoading || isSubmitting}
                        disabled={!teamName.trim() || isLoading || isSubmitting}
                    >
                        Create Team
                    </Button>
                </Container>
            </form>
        </Modal>
    );
};

export default TeamCreator;
