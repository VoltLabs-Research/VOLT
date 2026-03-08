import { forwardRef } from 'react';
import React from 'react';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
};

const Container = forwardRef<HTMLDivElement, ContainerProps>(({ children, className = '', ...props }, ref) => {
    return (
        <div ref={ref} className={`volt-container ${className}`} {...props}>
            {children}
        </div>
    );
});

Container.displayName = 'Container';

export default Container;