import Container from '@/shared/presentation/components/Container';

import type { ReactNode } from 'react';

interface ModifierConfigProps {
    children?: ReactNode;
};

const ModifierConfig = ({ children }: ModifierConfigProps) => (
    <Container className='d-flex column gap-05'>
        {children}
    </Container>
);

export default ModifierConfig;
