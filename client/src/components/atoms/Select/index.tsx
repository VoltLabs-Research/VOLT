import React from 'react';

interface SelectOption {
    value: string;
    title: string;
}

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    disabled = false,
    className = '',
    children
}) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={className}
        >
            {children}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.title}
                </option>
            ))}
        </select>
    );
};

export default Select;