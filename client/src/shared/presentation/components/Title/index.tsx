import React from 'react';

type TitleTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement>{
    as?: TitleTag;
    children?: React.ReactNode;
};

const Title = ({ as = 'h3', children, className = '', ...props }: TitleProps) => {
    const Component = as;

    return (
        <Component className={`volt-title ${className}`.trim()} {...props}>
            {children}
        </Component>
    );
};

export default Title;
