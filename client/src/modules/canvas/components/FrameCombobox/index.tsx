import { ComboBox, Input, Label, ListBox, cn } from '@heroui/react';
import { useMemo, useCallback } from 'react';

import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface FrameComboboxProps {
    value: number | undefined;
    options: number[];
    onChange: (value: number | undefined) => void;
    /** bravais put this on a `title`; it is the control's only name, so it is the label. */
    title?: string;
    /** Lands on the ComboBox root. */
    className?: string;
    /**
     * Lands on the input group. `Timeline.css` sized this control from the frame-info
     * row, and the group is the box that carries the width, height and fill.
     */
    groupClassName?: string;
}

/**
 * bravais's `Select isEditable` — a select whose trigger is a text input, so a frame
 * can be typed as well as picked — is HeroUI's `ComboBox`. `Select` would silently
 * drop the typing half.
 *
 * The metrics are the canvas field surface's own, restated because
 * `.form-field-canvas-input--compact` belonged to the deleted `FormField.css`. They
 * match `PerAtomViewer`, which has the same control.
 */
const GROUP_CLASS = 'h-6 min-h-6 rounded-lg border border-border bg-transparent shadow-none transition-colors duration-150 ease-out hover:border-border-secondary';

const INPUT_CLASS = 'h-6 min-h-6 border-0 bg-transparent px-[0.4rem] text-[0.7rem] text-foreground shadow-none placeholder:text-[0.7rem] placeholder:text-muted';

const FrameCombobox = ({ value, options, onChange, title, className, groupClassName }: FrameComboboxProps) => {
    const selectOptions: SelectOption[] = useMemo(
        () => options.map((n) => ({
            value: String(n),
            title: String(n)
        })),
        [options]
    );

    const handleSelectionChange = useCallback((key: string | null) => {
        if (key === null || key === '') {
            onChange(undefined);
            return;
        }

        const nextValue = Number(key);
        onChange(Number.isFinite(nextValue) ? nextValue : undefined);
    }, [onChange]);

    const normalizedValue = value !== undefined ? String(value) : null;
    const placeholder = value !== undefined ? String(value) : 'No frames';

    return (
        <ComboBox
            className={cn('min-w-0 shrink-0', className)}
            selectedKey={normalizedValue}
            onSelectionChange={(key) => handleSelectionChange(key === null ? null : String(key))}
            isDisabled={options.length === 0}
            aria-label={title ?? 'Select frame'}
        >
            <ComboBox.InputGroup className={cn(GROUP_CLASS, groupClassName)}>
                <Input className={INPUT_CLASS} placeholder={placeholder} />
                <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
                <ListBox>
                    {selectOptions.map((option) => (
                        <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                            <Label>{option.title}</Label>
                        </ListBox.Item>
                    ))}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
};

export default FrameCombobox;
