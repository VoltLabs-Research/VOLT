import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { LabelHTMLAttributes, ReactNode } from 'react';

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    children?: ReactNode;
}

const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(({
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'font-size-2',
        'font-weight-5',
        'color-secondary',
        className
    );

    return (
        <label ref={ref} className={classes} {...rest}>
            {children}
        </label>
    );
});

FormLabel.displayName = 'FormLabel';

export default FormLabel;
