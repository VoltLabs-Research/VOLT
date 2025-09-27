import React from 'react';

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => {
    return (
        <div className={`settings-section ${className}`}>
            {children}
        </div>
    );
};

export default Section;


