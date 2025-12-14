import React from 'react';
import Container from '@/components/primitives/Container';
import './SectionHeader.css';

interface SectionHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode; 
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, children }) => {
    return(
        <Container className='d-flex content-between'>
            <Container className='d-flex column gap-05'>
                <h3 className='section-title'>{title}</h3>
                {description && <p className='section-description'>{description}</p>}
            </Container>
            {children && (
                <Container className='d-flex items-center gap-1 mt-1'>
                    {children}
                </Container>
            )}
        </Container>
    );
};

export default SectionHeader;
