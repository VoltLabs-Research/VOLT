import composeRefs from '@/shared/presentation/utilities/compose-refs';
import './EditableTag.css';
import { useState, useRef, useEffect, forwardRef } from 'react';
import React from 'react';

interface EditableTagProps{
    as: keyof React.JSX.IntrinsicElements;
    onSave: (newValue: string) => void;
    children: React.ReactNode;
    className?: string;
    title?: string;
};

const EditableTag = React.memo(forwardRef<HTMLElement, EditableTagProps>(({ as: Tag, onSave, children, className, title }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    const selectAllText = (): void => {
        if(!elementRef.current) return;
        elementRef.current.focus();
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(elementRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    useEffect(() => {
        if(isEditing){
            selectAllText();
        }
    }, [isEditing]);

    const enableEditing = (): void => {
        setIsEditing(true);
    };

    const stopPropagation = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
    };

    const handleDoubleClick = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        enableEditing();
    };

    const handleSave = (): void => {
        setIsEditing(false);
        const newText = elementRef.current?.innerText.trim();
        if(newText && newText !== String(children)){
            onSave(newText);
        }else if(elementRef.current){
            elementRef.current.innerText = String(children);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent): void => {
        if(event.key === 'Enter'){
            event.preventDefault();
            handleSave();
        }else if(event.key === 'Escape'){
            if(elementRef.current){
                elementRef.current.innerText = String(children);
            }
            setIsEditing(false);
        }
    };

    return React.createElement(
        Tag,
        {
            ref: composeRefs(elementRef, ref) as React.Ref<HTMLElement>,
            className: `${className || ''} ${isEditing ? 'is-editing radius-xs' : ''}`,
            contentEditable: isEditing,
            onClick: stopPropagation,
            onMouseDown: stopPropagation,
            onDoubleClick: handleDoubleClick,
            onBlur: handleSave,
            onKeyDown: handleKeyDown,
            suppressContentEditableWarning: true,
            title
        },
        children
    );
}));

EditableTag.displayName = 'EditableTag';

export default EditableTag;
