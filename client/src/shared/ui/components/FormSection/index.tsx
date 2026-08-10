import { cn } from '@heroui/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Replaces the `.form-section-group .form-field-inline*` descendant selectors
 * that `FormSection.css` used to own.
 *
 * A field inside the group is not styled like a standalone inline field: it is
 * flattened into a bordered settings row (label column collapses to
 * `minmax(88px, 40%)`, the control loses its box and right-aligns, the row grows
 * a bottom rule). None of that can be a utility on the *field*, because the field
 * does not know where it is — so the group publishes the fact and
 * `resolveFieldSurface` picks the `section` class set.
 *
 * This is strictly equivalent to the selector it replaces for every call site:
 * all of them render their `FormFieldRHF`s inside the group element, and React
 * context follows arbitrary nesting exactly as a descendant selector does.
 */
const FormSectionGroupContext = createContext(false);

/** True when this field is rendered inside a `FormSection`'s group. */
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
    /*
     * `[.form-section+&]:mt-6` is the `.form-section + .form-section` rule, kept
     * as an adjacent-sibling variant rather than turned into `mt-6 first:mt-0`:
     * the original only spaced a section that follows *another section*, and
     * `first:mt-0` would also space one that follows an unrelated element.
     */
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
