import React, { useId, useMemo } from 'react';
import { IoExitOutline } from 'react-icons/io5';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import './Select.css';

export interface SelectOption {
    value: string;
    title: string;
    description?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    onDark?: boolean;
    showSelectionIcon?: boolean;
    optionClassName?: string;
    onLeaveTeam?: (value: string) => void;
}

const Select = ({
    options,
    value,
    onChange,
    disabled = false,
    onDark = false,
    placeholder = 'Select...',
    className = '',
    optionClassName = '',
    showSelectionIcon = true,
    onLeaveTeam,
    ...props
}: SelectProps) => {
    const uid = useId();

    const selectedOption = useMemo(() => {
        if (!value) return null;
        return options.find((o) => o.value === value) || null;
    }, [options, value]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
    };

    const handleLeaveTeam = (
        e: React.MouseEvent<HTMLSpanElement | HTMLDivElement>,
        teamId: string
    ) => {
        e.preventDefault();
        e.stopPropagation();
        onLeaveTeam?.(teamId);
    };

    return (
        <select
            id={uid}
            className={`volt-select ${onDark ? 'on-dark' : ''} ${className}`}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            {...props}
        >
            <button
                type='button'
                className='volt-select-trigger d-flex items-center gap-05 w-100'
            >
                <option
                    value=''
                    disabled
                    hidden
                >
                    <Container className='d-flex column'>
                        <Paragraph className='font-size-2 color-text-muted'>
                            {placeholder}
                        </Paragraph>
                    </Container>
                </option>

                <selectedcontent className='volt-select-value d-flex items-center gap-05' />

                <svg
                    className='volt-select-chevron'
                    width='18'
                    height='18'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                >
                    <path
                        d='M7 10l5 5 5-5'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                    />
                </svg>
            </button>

            {options.map((opt) => {
                const isSelected = opt.value === value;

                return (
                    <option
                        key={opt.value}
                        value={opt.value}
                        className={`select-option-container d-flex items-center content-between gap-05 ${optionClassName}`}
                    >
                        <Container className='d-flex column'>
                            <Paragraph className='font-size-2'>
                                {opt.title}
                            </Paragraph>

                            {opt.description && (
                                <Paragraph className='select-option-description color-muted font-size-1'>
                                    {opt.description}
                                </Paragraph>
                            )}
                        </Container>

                        {showSelectionIcon && isSelected && (
                            <svg
                                className='select-option-check'
                                width='16'
                                height='16'
                                viewBox='0 0 24 24'
                                aria-hidden='true'
                            >
                                <path
                                    d='M20 6L9 17l-5-5'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                />
                            </svg>
                        )}

                        {onLeaveTeam && (
                            <Container
                                className='select-option-leave-wrapper'
                                title='Leave'
                                onClick={(e: React.MouseEvent<HTMLDivElement>) => handleLeaveTeam(e, opt.value)}
                            >
                                <IoExitOutline size={16} />
                            </Container>
                        )}
                    </option>
                );
            })}
        </select>
    );
};

export default Select;
