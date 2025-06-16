import React from 'react';
import './Text.css';

interface TextProps {
    children: React.ReactNode;
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'label';
    color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success';
    className?: string;
}

const Text: React.FC<TextProps> = ({
    children,
    variant = 'body',
    color = 'primary',
    className = ''
}) => {
    const Component = variant.startsWith('h') ? variant as keyof JSX.IntrinsicElements : 'p';
    const classes = `atom-text atom-text--${variant} atom-text--${color} ${className}`;

    return (
        <Component className={classes}>
            {children}
        </Component>
    );
};

export default Text;