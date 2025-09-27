import React from 'react';
import Draggable from '@/components/atoms/Draggable';
import WindowIcons from '@/components/molecules/WindowIcons';
import FormInput from '@/components/atoms/form/FormInput';
import TeamCreatorBg from '@/assets/images/create-new-team.webp';
import './TeamCreator.css';
import Button from '@/components/atoms/Button';

const TeamCreator = () => {

    return (
        <Draggable className='team-creator-container primary-surface'>
            <WindowIcons withBackground />

            <div className='team-creator-left-container'>
                <img src={TeamCreatorBg} className='team-creator-background' />
            </div>

            <div className='team-creator-right-container'>
                <div className='team-creator-header-container'>
                    <h3 className='team-creator-title'>Create a new team</h3>
                    <p className='team-creator-description'>When you create an account, you're assigned a personal team. You can create new teams to manage your trajectories and work with others.</p>
                </div>
                <div className='team-creator-body-container'>
                    <FormInput
                        label='Enter a name for your team' />

                    <Button
                        className='black-on-light sm'
                        title='Continue' />
                </div>
            </div>
        </Draggable>
    );
};

export default TeamCreator;