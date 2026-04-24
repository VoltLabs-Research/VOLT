import Heading from '@/shared/presentation/primitives/Heading';
import Stack from '@/shared/presentation/primitives/Stack';
import './SettingsPage.css';
import { useId } from 'react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
    title: string;
    children: ReactNode;
};

const SettingsPage = ({ title, children }: SettingsPageProps) => {
    const titleId = useId();

    return (
        <Stack as='section' gap='3' p='2' className='settings-page-container' aria-labelledby={titleId}>
            <Heading level={1} size='2xl' weight='bold' id={titleId}>
                {title}
            </Heading>
            <Stack gap='3' className='settings-page-content'>
                {children}
            </Stack>
        </Stack>
    );
};

export default SettingsPage;
