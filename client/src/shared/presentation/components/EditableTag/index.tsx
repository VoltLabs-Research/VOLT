import composeRefs from '@/shared/presentation/utilities/compose-refs';
import './EditableTag.css';
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

interface EditableTagProps {
    as: keyof React.JSX.IntrinsicElements;
    onSave: (newValue: string) => void;
    children: React.ReactNode;
    className?: string;
    title?: string;
    allowSingleClickPropagation?: boolean;
};

const getTextValue = (children: React.ReactNode): string => {
    if (typeof children === 'string' || typeof children === 'number') {
        return String(children);
    }

    return '';
};

const EditableTag = React.memo(forwardRef<HTMLElement, EditableTagProps>(({ as: Tag, onSave, children, className, title, allowSingleClickPropagation = false }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const elementRef = useRef<HTMLElement>(null);
    const textValue = useMemo(() => getTextValue(children), [children]);
    const accessibleLabel = textValue
        ? `${textValue}. Press Enter or F2 to edit.`
        : 'Press Enter or F2 to edit.';
    const combinedTitle = title ?? (textValue || undefined);
    const combinedRef = composeRefs<HTMLElement>(elementRef, ref);

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

    const enableEditing = (): void => {
        setIsEditing(true);
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
        if (allowSingleClickPropagation && !isEditing) {
            return;
        }

        event.stopPropagation();
    };

    const handleDoubleClick = (event: React.MouseEvent<HTMLElement>): void => {
        if (allowSingleClickPropagation) {
            return;
        }

        event.stopPropagation();
        enableEditing();
    };

    const handleSave = (): void => {
        if (!isEditing) {
            return;
        }

        setIsEditing(false);

        const newText = elementRef.current?.innerText.trim();

        if (newText && newText !== textValue) {
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

        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            handleSave();
            return;
        }

        if (event.key === 'Escape') {
            event.stopPropagation();

            if (elementRef.current) {
                elementRef.current.innerText = textValue;
            }

            setIsEditing(false);
        }
    };

    return React.createElement(
        Tag,
        {
            ref: combinedRef,
            className: `editable-tag ${className || ''} ${isEditing ? 'is-editing radius-xs' : 'editable-tag--interactive radius-xs'}`.trim(),
            contentEditable: isEditing,
            tabIndex: isEditing ? -1 : 0,
            onClick: handleClick,
            onMouseDown: handleClick,
            onDoubleClick: handleDoubleClick,
            onBlur: handleSave,
            onKeyDown: handleKeyDown,
            suppressContentEditableWarning: true,
            title: combinedTitle,
            'aria-label': accessibleLabel,
            'aria-keyshortcuts': 'Enter F2',
            'data-interactive-card-control': allowSingleClickPropagation ? undefined : 'true'
        },
        children
    );
}));

EditableTag.displayName = 'EditableTag';

export default EditableTag;
