import React from 'react';
import Draggable from '@/components/atoms/Draggable';
import WindowIcons from '@/components/molecules/WindowIcons';
import './DraggableBinaryContainer.css';

interface DraggableBinaryContainerProps{
    onClose?: () => void;
    handleSubmit?: (data: any) => void;
    children: any,
    bg: any;
    title: string;
    description: string;
}

const DraggableBinaryContainer: React.FC<DraggableBinaryContainerProps> = ({ title, handleSubmit, description, onClose, bg, children }) => {
    
    return (
        <Draggable className='team-creator-container primary-surface'>
            <WindowIcons 
                onClose={onClose}
                withBackground />

            <div className='team-creator-left-container'>
                <img src={bg} className='team-creator-background' />
            </div>

            <div className='team-creator-right-container'>
                <div className='team-creator-header-container'>
                    <h3 className='team-creator-title'>{title}</h3>
                    <p className='team-creator-description'>{description}</p>
                </div>
                
                <form onSubmit={handleSubmit} className='team-creator-body-container'>
                    {children}
                </form>
            </div>
        </Draggable>
    );
};

export default DraggableBinaryContainer;