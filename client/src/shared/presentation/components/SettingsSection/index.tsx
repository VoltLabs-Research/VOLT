import Stack from '@/shared/presentation/primitives/Stack';
import type { ReactNode } from 'react';

export interface SettingsSectionProps {
    children: ReactNode;
    className?: string;
};

const SettingsSection = ({ children, className }: SettingsSectionProps) => {
    return (
        <Stack border='soft' gap='1' p='1-5' radius='md' className={className}>
            {children}
        </Stack>
    );
};

export default SettingsSection;
