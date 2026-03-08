import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';

interface SettingsPageProps {
    title: string;
    children: React.ReactNode;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ title, children }) => (
    <Container className="settings-page-container d-flex column gap-3 p-2">
        <Title className="font-size-5 font-weight-6">{title}</Title>
        {children}
    </Container>
);

export default SettingsPage;
