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

import React from 'react';
import { createPortal } from 'react-dom';
import type { FloatingMenuProps } from '@/types/floating-container';
import FloatingMenuItem from '@/components/atoms/FloatingMenuItem';

interface ExtendedFloatingMenuProps extends FloatingMenuProps {
    deleteMenuStyle?: boolean;
}

const FloatingMenu: React.FC<ExtendedFloatingMenuProps> = ({
    isVisible,
    menuRef,
    styles,
    options,
    onItemClick,
    className = 'action-based-floating-container',
    portalTarget = document.body,
    deleteMenuStyle = false
}) => {
    if(!isVisible){
        return null;
    }

    const baseMenuStyles: React.CSSProperties = {
        backgroundColor: 'white',
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '150px',
        padding: '8px',
        display: 'flex',
        gap: '1rem',
        flexDirection: 'column',
        ...styles
    };

    return createPortal(
        <div
            ref={menuRef}
            style={baseMenuStyles}
            className={className}
        >
            {options.map((option, index) => {
                if (Array.isArray(option)) {
                    const [name, Icon, onClick] = option;
                    return (
                        <div
                            key={index}
                            className={`floating-menu-item ${deleteMenuStyle ? 'delete-menu-item' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onItemClick) {
                                    onItemClick(onClick, e);
                                    return;
                                }

                                if(typeof onClick === 'function'){
                                    onClick();
                                }
                            }}
                            style={{
                                padding: '8px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: deleteMenuStyle ? '#dc2626' : '#374151',
                                transition: 'background-color 0.2s ease',
                                borderRadius: '.5rem',
                                margin: '0 4px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = deleteMenuStyle ? '#fee2e2' : '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <Icon size={16} />
                            <span>{name}</span>
                        </div>
                    );
                } else {
                    return (
                        <FloatingMenuItem
                            key={option.id || index}
                            name={option.label}
                            Icon={option.icon}
                            onClick={option.onClick || (() => {})}
                            onItemClick={onItemClick}
                            className={option.className}
                            danger={option.danger}
                        />
                    );
                }
            })}
        </div>,
        portalTarget
    )
};

export default FloatingMenu;