import { useId } from 'react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
    title: string;
    children: ReactNode;
};

const SettingsPage = ({ title, children }: SettingsPageProps) => {
    const titleId = useId();

    return (
        <section className='flex flex-col gap-12 p-8 max-w-[800px] mx-auto' aria-labelledby={titleId}>
            <h1 className='text-2xl font-semibold text-foreground' id={titleId}>
                {title}
            </h1>
            <div className='flex flex-col gap-12 min-w-0'>
                {children}
            </div>
        </section>
    );
};

export default SettingsPage;
