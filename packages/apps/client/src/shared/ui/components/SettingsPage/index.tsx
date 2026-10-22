import { useId } from 'react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
    title: string;
    children: ReactNode;
};

const SettingsPage = ({ title, children }: SettingsPageProps) => {
    const titleId = useId();

    return (
        // The mockup's settings page body: 48rem at most, the title 24px above sections 32px apart.
        <section className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-3 pb-8' aria-labelledby={titleId}>
            <h1 className='text-2xl font-semibold tracking-[-0.01em] text-foreground' id={titleId}>
                {title}
            </h1>
            <div className='flex flex-col gap-8 min-w-0'>
                {children}
            </div>
        </section>
    );
};

export default SettingsPage;
