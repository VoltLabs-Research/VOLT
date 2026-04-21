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
        <section className='settings-page-container d-flex column gap-3 p-2' aria-labelledby={titleId}>
            <h1 id={titleId} className='volt-title font-size-5 font-weight-6'>
                {title}
            </h1>
            <div className='volt-container settings-page-content d-flex column gap-3'>
                {children}
            </div>
        </section>
    );
};

export default SettingsPage;
