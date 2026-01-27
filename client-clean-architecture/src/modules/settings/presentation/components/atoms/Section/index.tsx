import React from 'react';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/settings/presentation/components/atoms/Section/Section.css';

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => {
    return(
        <Container className={`settings-section d-flex column gap-2 ${className} p-relative p-2`}>
            {children}
        </Container>
    );
};

export default Section;
