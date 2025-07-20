/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

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