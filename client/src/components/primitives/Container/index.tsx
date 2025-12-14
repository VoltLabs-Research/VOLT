import React from 'react';
import './Container.css';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement>{
    children?: React.ReactNode;
};

const Container = ({ children, className, ...props }: ContainerProps) => {
    return (
        <div className={`volt-container ${className}`} {...props}>
            {children}
        </div>
    );
};

export default Container;