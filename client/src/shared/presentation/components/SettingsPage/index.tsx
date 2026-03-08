import './SettingsPage.css';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import type { ReactNode } from 'react';

interface SettingsPageProps {
    title: string;
    children: ReactNode;
};

const SettingsPage = ({ title, children }: SettingsPageProps) => (
    <Container className="settings-page-container d-flex column gap-3 p-2">
        <Title className="font-size-5 font-weight-6">{title}</Title>
        {children}
    </Container>
);

export default SettingsPage;
