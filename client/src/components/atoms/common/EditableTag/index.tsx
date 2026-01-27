/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import React, { useState, useRef, useEffect } from 'react';
import '@/components/atoms/common/EditableTag/EditableTag.css';

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
        if(isEditing && elementRef.current){
            elementRef.current.focus();
            // select text without execCommand
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
        if(newText && newText !== String(children)) {
            onSave(newText);
        }else if(elementRef.current){
            elementRef.current.innerText = String(children);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
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

    return(
        <Tag
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
        </Tag>
    );
});

export default EditableTag;
