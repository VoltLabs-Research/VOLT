import composeRefs from '@/shared/ui/utils/compose-refs';
import { cn } from '@heroui/react';
import React, { forwardRef, useEffect, useRef, useState } from 'react';

interface EditableTagProps {
    as: keyof React.JSX.IntrinsicElements;
    onSave: (newValue: string) => void;
    children: React.ReactNode;
    className?: string;
    title?: string;
    // Called for a click that no second click follows, so the click can still open whatever holds
    // the tag while a double click edits it.
    onSingleClick?: () => void;
    allowEmpty?: boolean;
    editing?: boolean;
    onEditingChange?: (isEditing: boolean) => void;
};

const DOUBLE_CLICK_WINDOW_MS = 300;

const getTextValue = (children: React.ReactNode): string => {
    if (typeof children === 'string' || typeof children === 'number') {
        return String(children);
    }

    return '';
};

const EditableTag = React.memo(forwardRef<HTMLElement, EditableTagProps>(({ as: Tag, onSave, children, className, title, onSingleClick, allowEmpty = false, editing, onEditingChange }, ref) => {
    const [internalEditing, setInternalEditing] = useState(false);
    const elementRef = useRef<HTMLElement>(null);
    const singleClickTimer = useRef<number | undefined>(undefined);
    const textValue = getTextValue(children);
    const accessibleLabel = textValue
        ? `${textValue}. Press Enter or F2 to edit.`
        : 'Press Enter or F2 to edit.';
    const combinedTitle = title ?? (textValue || undefined);
    const combinedRef = composeRefs<HTMLElement>(elementRef, ref);
    const isEditing = editing ?? internalEditing;

    const setEditingState = (nextValue: boolean): void => {
        if (editing === undefined) {
            setInternalEditing(nextValue);
        }

        onEditingChange?.(nextValue);
    };

    const selectAllText = (): void => {
        if (!elementRef.current) {
            return;
        }

        elementRef.current.focus();

        const range = document.createRange();
        const selection = window.getSelection();

        range.selectNodeContents(elementRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    useEffect(() => {
        if (isEditing) {
            selectAllText();
        }
    }, [isEditing]);

    const cancelSingleClick = (): void => {
        window.clearTimeout(singleClickTimer.current);
        singleClickTimer.current = undefined;
    };

    useEffect(() => cancelSingleClick, []);

    const enableEditing = (): void => {
        setEditingState(true);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLElement>): void => {
        if (onSingleClick && !isEditing) {
            return;
        }

        event.stopPropagation();
    };

    // The click itself never reaches the holder: a single click there would act before the second
    // click of a double click arrives. `detail` counts the clicks in a row, so the second one only
    // cancels the first.
    const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        cancelSingleClick();

        if (!onSingleClick || isEditing || event.detail > 1) {
            return;
        }

        singleClickTimer.current = window.setTimeout(() => {
            singleClickTimer.current = undefined;
            onSingleClick();
        }, DOUBLE_CLICK_WINDOW_MS);
    };

    const handleDoubleClick = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        cancelSingleClick();
        enableEditing();
    };

    const handleSave = (): void => {
        if (!isEditing) {
            return;
        }

        setEditingState(false);

        const newText = elementRef.current?.innerText.trim();

        if (newText !== undefined && newText !== textValue && (newText || allowEmpty)) {
            onSave(newText);
            return;
        }

        if (elementRef.current) {
            elementRef.current.innerText = textValue;
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent): void => {
        if (!isEditing && (event.key === 'Enter' || event.key === ' ' || event.key === 'F2')) {
            event.preventDefault();
            event.stopPropagation();
            enableEditing();
            return;
        }

        if (!isEditing) {
            return;
        }

        event.stopPropagation();

        if (event.key === 'Enter') {
            event.preventDefault();
            handleSave();
            return;
        }

        if (event.key === 'Escape') {
            if (elementRef.current) {
                elementRef.current.innerText = textValue;
            }

            setEditingState(false);
        }
    };

    return React.createElement(
        Tag,
        {
            ref: combinedRef,
            // The mockup's inline rename: a 4% tint on hover, 6% with a soft ring while editing.
            // volt-no-drag: in the desktop window's draggable headers, a double click here would
            // otherwise maximize the window instead of editing.
            className: cn('volt-no-drag cursor-text rounded-md', isEditing ? 'w-fit min-w-[2ch] bg-foreground/6 outline-none ring-2 ring-foreground/15' : 'transition-[background-color,box-shadow] duration-150 hover:bg-foreground/4 focus-visible:bg-foreground/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', className),
            contentEditable: isEditing,
            tabIndex: isEditing ? -1 : 0,
            onClick: handleClick,
            onMouseDown: handleMouseDown,
            onDoubleClick: handleDoubleClick,
            onBlur: handleSave,
            onKeyDown: handleKeyDown,
            suppressContentEditableWarning: true,
            title: combinedTitle,
            'aria-label': accessibleLabel,
            'aria-keyshortcuts': 'Enter F2',
            'data-interactive-card-control': onSingleClick ? undefined : 'true'
        },
        children
    );
}));

EditableTag.displayName = 'EditableTag';

export default EditableTag;
