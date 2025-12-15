import React from 'react';

interface TitleProps extends React.HTMLAttributes<HTMLHRElement>{
    children?: React.ReactNode;
};

const Title = ({ children, className, ...props }: TitleProps) => {
    return (
        <h3 className={`volt-title ${className}`} {...props}>
            {children}
        </h3>
    );
};

export default Title;