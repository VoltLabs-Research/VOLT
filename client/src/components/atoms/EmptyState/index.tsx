import React from 'react';
import './EmptyState.css';

const EmptyState = ({ title, description }: any) => {

    return (
        <div className='empty-state-container'>
            <div className='empty-state-content'>
                <h2 className='empty-state-title'>{title}</h2>
                <p className='empty-state-description'>{description}</p>
            </div>
        </div>
    );
};

export default EmptyState;