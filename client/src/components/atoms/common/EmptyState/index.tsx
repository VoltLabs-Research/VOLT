import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    buttonText?: string;
    buttonOnClick?: () => void;
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    buttonText,
    buttonOnClick,
    className
}: EmptyStateProps) => {

    return(
        <div className={`empty-state-container ${className || ''}`}>
            <div className='empty-state-content'>
                {icon && (
                    <div className='empty-state-icon'>
                        {icon}
                    </div>
                )}
                <h2 className='empty-state-title'>{title}</h2>
                <p className='empty-state-description'>{description}</p>
                {buttonText && buttonOnClick && (
                    <button
                        className='empty-state-button'
                        onClick={buttonOnClick}
                    >
                        {buttonText}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
