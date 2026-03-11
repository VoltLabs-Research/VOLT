import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import SearchInput from '@/shared/presentation/components/SearchInput';
import Container from '@/shared/presentation/components/Container';
import '@/shared/presentation/components/FormFieldRHF/FormField.css';
import '@/shared/presentation/components/Select/Select.css';
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useCallback, useMemo, useState } from 'react';

interface SelectedTimestepsFieldProps {
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onChange: (selectedTimesteps?: number[]) => void;
};

const SelectedTimestepsField = ({
    availableTimesteps,
    selectedTimesteps,
    onChange
}: SelectedTimestepsFieldProps) => {
    const floatingRoot = useFloatingRoot();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [
            offset(4),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
                apply({ rects, elements }) {
                    Object.assign(elements.floating.style, {
                        minWidth: `${Math.max(rects.reference.width, 180)}px`
                    });
                },
                padding: 8
            })
        ],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

    const filteredTimesteps = useMemo(() => {
        if (!query.trim()) {
            return availableTimesteps;
        }

        return availableTimesteps.filter((timestep) => String(timestep).includes(query.trim()));
    }, [availableTimesteps, query]);

    const selectedTimestepSet = useMemo(() => {
        return new Set(selectedTimesteps ?? []);
    }, [selectedTimesteps]);

    const triggerLabel = useMemo(() => {
        if (!selectedTimesteps?.length) {
            return 'All';
        }

        return `${selectedTimesteps.length} selected`;
    }, [selectedTimesteps]);

    const handleSelectAll = useCallback(() => {
        onChange(undefined);
    }, [onChange]);

    const handleToggleTimestep = useCallback((timestep: number) => {
        const nextSelection = availableTimesteps.filter((candidateTimestep) => {
            if (candidateTimestep === timestep) {
                return !selectedTimestepSet.has(candidateTimestep);
            }

            return selectedTimestepSet.has(candidateTimestep);
        });

        if (!nextSelection.length || nextSelection.length === availableTimesteps.length) {
            onChange(undefined);
            return;
        }

        onChange(nextSelection);
    }, [availableTimesteps, onChange, selectedTimestepSet]);

    const renderTimestepOption = useCallback((timestep: number) => {
        const isSelected = selectedTimestepSet.has(timestep);

        return (
            <Container
                key={timestep}
                className={`form-field-canvas-option d-flex items-center gap-05 cursor-pointer${isSelected ? ' is-selected' : ''}`}
                onMouseDown={(event) => {
                    event.preventDefault();
                    handleToggleTimestep(timestep);
                }}
            >
                <span className='flex-1'>{timestep}</span>
                {isSelected && <span className='color-primary'>✓</span>}
            </Container>
        );
    }, [handleToggleTimestep, selectedTimestepSet]);

    return (
        <Container className='form-field-canvas d-flex items-center'>
            <span className='canvas-form-label' style={{ width: 120, minWidth: 120 }}>
                Selected Timesteps
            </span>
            <Container className='render-input-container flex-1 min-w-0'>
                <button
                    ref={refs.setReference}
                    type='button'
                    className={`select-trigger d-flex items-center gap-05 ${isOpen ? 'open' : ''}`}
                    style={{ width: '100%' }}
                    {...getReferenceProps()}
                >
                    <span className='select-value overflow-hidden'>{triggerLabel}</span>
                    <svg
                        className={`select-chevron ${isOpen ? 'rotated' : ''}`}
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
            </Container>

            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <Container
                        ref={refs.setFloating}
                        className='form-field-canvas-dropdown d-flex column gap-025'
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <SearchInput
                            variant='small'
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder='Search timesteps...'
                            containerClassName='form-field-canvas-field'
                        />

                        <Container
                            className={`form-field-canvas-option d-flex items-center gap-05 cursor-pointer${selectedTimesteps?.length ? '' : ' is-selected'}`}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                handleSelectAll();
                            }}
                        >
                            <span className='flex-1'>All</span>
                            {!selectedTimesteps?.length && <span className='color-primary'>✓</span>}
                        </Container>

                        <Container className='d-flex column gap-025 overflow-auto'>
                            {filteredTimesteps.map(renderTimestepOption)}
                            {filteredTimesteps.length === 0 && (
                                <Container className='form-field-canvas-option color-muted'>
                                    No matching timesteps
                                </Container>
                            )}
                        </Container>
                    </Container>
                </FloatingPortal>
            )}
        </Container>
    );
};

export default SelectedTimestepsField;
