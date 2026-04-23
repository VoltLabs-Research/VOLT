import { Stack } from '@/shared/presentation/primitives';
import type { ReactNode } from 'react';

interface ModifierConfigProps {
    children?: ReactNode;
};

const ModifierConfig = ({ children }: ModifierConfigProps) => (
    <Stack gap='05'>
        {children}
    </Stack>
);

export default ModifierConfig;
