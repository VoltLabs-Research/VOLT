import './SettingsPage.css';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { useId } from 'react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
    title: string;
    children: ReactNode;
};

const SettingsPage = ({ title, children }: SettingsPageProps) => {
    const titleId = useId();

    return (
        <section className='settings-page-container d-flex column gap-3 p-2' aria-labelledby={titleId}>
            <Title as='h1' id={titleId} className='font-size-5 font-weight-6'>
                {title}
            </Title>
            <Container className='settings-page-content d-flex column gap-3'>
                {children}
            </Container>
        </section>
    );
};

export default SettingsPage;
