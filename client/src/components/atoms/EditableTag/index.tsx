import React, { useState, useRef } from 'react';
import './EditableTag.css';

const EditableTag = ({ as: Tag, onSave, children, className, ...rest }) => {
    const [isEditing, setIsEditing] = useState(false);
    const elementRef = useRef(null);

    const enableEditing = () => {
        setIsEditing(true);
        setTimeout(() => {
            elementRef.current?.focus();
            document.execCommand('selectAll', false, null);
            document.getSelection()?.collapseToEnd();
        }, 0);
    };

    const handleSave = () => {
        setIsEditing(false);
        const newText = elementRef.current?.innerText.trim();
        if(newText && newText !== children){
            onSave(newText);
        }else if(elementRef.current){
            // If the text hasn't changed or is invalid, we revert it to the original
            elementRef.current.innerText = children;
        }
    };

    const handleKeyDown = (event) => {
        if(event.key === 'Enter'){
            // Prevents a line break from being inserted
            event.preventDefault();
            handleSave();
        }else if(event.key === 'Escape'){
            if(elementRef.current){
                elementRef.current.innerText = children;
            }
            setIsEditing(false);
        }
    };

    return (
        <Tag
            ref={elementRef}
            className={`${className} ${isEditing ? 'is-editing' : ''}`}
            contentEditable={isEditing}
            onDoubleClick={enableEditing}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning={true}
            {...rest}
        >
            {children}
        </Tag>
    )
};

export default EditableTag;