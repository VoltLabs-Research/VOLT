import React, { useState, useRef, useEffect } from 'react';
import '@/shared/presentation/components/atoms/common/EditableTag/EditableTag.css';

interface EditableTagProps {
    as: keyof React.JSX.IntrinsicElements;
    onSave: (newValue: string) => void;
    children: React.ReactNode;
    className?: string;
    title?: string;
    [key: string]: any;
}

const EditableTag: React.FC<EditableTagProps> = React.memo(({ as: Tag, onSave, children, className, ...rest }) => {
    const [isEditing, setIsEditing] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (isEditing && elementRef.current) {
            elementRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(elementRef.current);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    }, [isEditing]);

    const enableEditing = () => {
        setIsEditing(true);
    };

    const handleSave = () => {
        setIsEditing(false);
        const newText = elementRef.current?.innerText.trim();
        if (newText && newText !== String(children)) {
            onSave(newText);
        } else if (elementRef.current) {
            elementRef.current.innerText = String(children);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSave();
        } else if (event.key === 'Escape') {
            if (elementRef.current) {
                elementRef.current.innerText = String(children);
            }
            setIsEditing(false);
        }
    };

    const TagComponent = Tag as any;

    return (
        <TagComponent
            ref={elementRef as React.RefObject<any>}
            className={`${className || ''} ${isEditing ? 'is-editing' : ''}`}
            contentEditable={isEditing}
            onDoubleClick={enableEditing}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning={true}
            {...rest}
        >
            {children}
        </TagComponent>
    );
});

export default EditableTag;
