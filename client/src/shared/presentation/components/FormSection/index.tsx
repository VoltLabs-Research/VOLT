import type { ReactNode } from 'react';
import './FormSection.css';

interface FormSectionProps {
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
};

const FormSection = ({ title, description, children, className = '' }: FormSectionProps) => {
    const rootClassName = ['form-section', className].filter(Boolean).join(' ');

    return (
        <section className={rootClassName}>
            {(title || description) && (
                <header className='form-section-header'>
                    {title && <h3 className='form-section-title text-eyebrow'>{title}</h3>}
                    {description && <p className='form-section-description'>{description}</p>}
                </header>
            )}
            <div className='form-section-group' role='group'>
                {children}
            </div>
        </section>
    );
};

export default FormSection;
