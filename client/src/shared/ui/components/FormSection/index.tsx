import { cn } from '@heroui/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const FormSectionGroupContext = createContext(false);

export const useIsInFormSectionGroup = (): boolean => {
    return useContext(FormSectionGroupContext);
};

interface FormSectionProps {
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
};

const FormSection = ({ title, description, children, className = '' }: FormSectionProps) => {
    const rootClassName = cn('form-section flex flex-col [.form-section+&]:mt-6', className);

    return (
        <section className={rootClassName}>
            {(title || description) && (
                <header className='form-section-header px-1 pb-2'>
                    {title && <h3 className='form-section-title text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-muted'>{title}</h3>}
                    {description && <p className='form-section-description mt-1 text-xs leading-[1.4] text-muted'>{description}</p>}
                </header>
            )}
            <FormSectionGroupContext.Provider value>
                <div className='form-section-group overflow-hidden rounded-xl border-t border-border' role='group'>
                    {children}
                </div>
            </FormSectionGroupContext.Provider>
        </section>
    );
};

export default FormSection;
