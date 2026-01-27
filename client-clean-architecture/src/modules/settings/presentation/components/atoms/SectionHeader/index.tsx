import React from 'react';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/settings/presentation/components/atoms/SectionHeader/SectionHeader.css';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';

interface SectionHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, children }) => {
    return(
        <Container className='d-flex content-between'>
            <Container className='d-flex column'>
                <Title className='font-size-4 font-weight-6 text-primary section-title'>{title}</Title>
                {description && <Paragraph className='font-size-2-5 text-secondary line-height-5'>{description}</Paragraph>}
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
