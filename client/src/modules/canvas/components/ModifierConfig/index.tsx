import type { ReactNode } from 'react';

interface ModifierConfigProps {
    children?: ReactNode;
};

const ModifierConfig = ({ children }: ModifierConfigProps) => (
    <div className='volt-container d-flex column gap-05'>
        {children}
    </div>
);

export default ModifierConfig;
