import React from 'react';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    children: React.ReactNode;
};

const IconButton = ({ label, children, className = '', ...rest }: IconButtonProps) => {
    return(
        <button
            type="button"
            aria-label={label}
            title={label}
            className={`icon-button ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}

export default IconButton;
