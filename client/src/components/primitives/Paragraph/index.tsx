import React from 'react';

interface ParagraphProps extends React.HTMLAttributes<HTMLHRElement>{
    children?: React.ReactNode;
};

/** TODO: MAX LINES PROPERTY */
const Paragraph = ({ children, className, ...props }: ParagraphProps) => {
    return (
        <p className={`volt-text ${className}`} {...props}>
            {children}
        </p>
    );
};

export default Paragraph;