import React, { useState } from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import TeamCreatorBg from '@/assets/images/create-new-team.webp';
import Button from '@/components/atoms/Button';
import useTeamStore from '@/stores/team/team';
import Loader from '@/components/atoms/Loader';
import useWindowsStore from '@/stores/ui/windows';
import DraggableBinaryContainer from '../DraggableBinaryContainer';
import './TeamCreator.css';

interface TeamCreatorProps {
    onClose?: () => void;
}

const TeamCreator: React.FC<TeamCreatorProps> = ({ onClose }) => {
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toggleTeamCreator = useWindowsStore((state) => state.toggleTeamCreator);
    
    const { createTeam, isLoading, error, clearError } = useTeamStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!teamName.trim()) {
            return;
        }

        setIsSubmitting(true);
        clearError();

        try {
            await createTeam({
                name: teamName.trim(),
                description: teamDescription.trim() || undefined
            });
            
            // Reset form
            setTeamName('');
            setTeamDescription('');
            
            // Close modal if onClose is provided
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
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTeamDescription(e.target.value);
    };

    return (
        <DraggableBinaryContainer
            title='Create a new team'
            description="When you create an account, you're assigned a personal team. You can create new teams to manage your trajectories and work with others."
            bg={TeamCreatorBg}
            handleSubmit={handleSubmit}
            onClose={toggleTeamCreator}
        >
            <FormInput
                label='Enter a name for your team'
                value={teamName}
                onChange={handleNameChange}
                placeholder='Team name'
                required
                disabled={isLoading || isSubmitting}
            />
            
            <FormInput
                label='Description (optional)'
                value={teamDescription}
                onChange={handleDescriptionChange}
                placeholder='Team description'
                disabled={isLoading || isSubmitting}
            />

            {error && (
                <div className='team-creator-error'>
                    {error}
                </div>
            )}

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
                />
            )}
        </DraggableBinaryContainer>
    );
};

export default TeamCreator;