import React, { useState } from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import TeamCreatorBg from '@/assets/images/create-new-team.webp';
import Button from '@/components/atoms/common/Button';
import useTeamStore from '@/stores/team/team';
import Loader from '@/components/atoms/common/Loader';
import useWindowsStore from '@/stores/ui/windows';
import useToast from '@/hooks/ui/use-toast';
import DraggableBinaryContainer from '@/components/organisms/common/DraggableBinaryContainer';
import { useFormValidation } from '@/hooks/useFormValidation';
import './TeamCreator.css';

interface TeamCreatorProps {
    onClose?: () => void;
    isRequired?: boolean;
}

const TeamCreator: React.FC<TeamCreatorProps> = ({ onClose, isRequired = false }) => {
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toggleTeamCreator = useWindowsStore((state) => state.toggleTeamCreator);
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
        if(isRequired){
            showError('You must create a team to continue.');
            return;
        }
        toggleTeamCreator();
        onClose?.();
    };

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();

        if(!validate({ teamName, teamDescription })) {
            return;
        }

        setIsSubmitting(true);
        clearError();

        try{
            await createTeam({
                name: teamName.trim(),
                description: teamDescription.trim() || undefined
            });

            setTeamName('');
            setTeamDescription('');
            onClose?.();
        }catch(err){
            console.error('Failed to create team:', err);
        }finally{
            setIsSubmitting(false);
            toggleTeamCreator();
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamName(e.target.value);
        if(error) clearError();
        checkField('teamName', e.target.value);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamDescription(e.target.value);
        checkField('teamDescription', e.target.value);
    };

    return(
        <DraggableBinaryContainer
            title='Create a new team'
            description="When you create an account, you're assigned a personal team. You can create new teams to manage your trajectories and work with others."
            bg={TeamCreatorBg}
            handleSubmit={handleSubmit}
            onClose={handleClose}
            isRequired={isRequired}
        >
            <FormInput
                label='Enter a name for your team'
                value={teamName}
                onChange={handleNameChange}
                placeholder='Team name'
                required
                disabled={isLoading || isSubmitting}
                error={errors.teamName}
            />
            <FormInput
                label='Description(optional)'
                value={teamDescription}
                onChange={handleDescriptionChange}
                placeholder='Team description'
                disabled={isLoading || isSubmitting}
                error={errors.teamDescription}
            />

            {(isLoading || isSubmitting) ? (
                <div className='team-creator-loader-container'>
                    <Loader scale={0.6} />
                </div>
            ) : (
                <Button
                    type='submit'
                    className='black-on-light sm'
                    title={'Continue'}
                    disabled={!teamName.trim() || isLoading || isSubmitting}
                >
                    Continue
                </Button>
            )}
        </DraggableBinaryContainer>
    );
};

export default TeamCreator;
