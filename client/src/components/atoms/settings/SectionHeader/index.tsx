import React from 'react';

interface SectionHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode; // actions
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, children }) => {
    return (
        <div className='section-header'>
            <div className='section-header-content'>
                <h3 className='section-title'>{title}</h3>
                {description && <p className='section-description'>{description}</p>}
            </div>
            {children && (
                <div className='section-header-actions'>
                    {children}
                </div>
            )}
        </div>
    );
};

export default SectionHeader;


