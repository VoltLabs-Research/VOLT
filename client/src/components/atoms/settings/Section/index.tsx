import React from 'react';
import Container from '@/components/primitives/Container';
import './Section.css';

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => {
    return(
        <Container className={`settings-section ${className} p-relative`}>
            {children}
        </Container>
    );
};

export default Section;
