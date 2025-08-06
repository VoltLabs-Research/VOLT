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

const FloatingMenu: React.FC<FloatingMenuProps> = ({
    isVisible,
    menuRef,
    styles,
    options,
    onItemClick,
    className = 'action-based-floating-container',
    portalTarget = document.body
}) => {
    if(!isVisible){
        return null;
    }

    return createPortal(
        <div
            ref={menuRef}
            style={styles}
            className={className}
        >
            {options.map(([ name, Icon, onClick ], index) => (
                <FloatingMenuItem
                    key={index}
                    name={name}
                    Icon={Icon}
                    onClick={onClick}
                    onItemClick={onItemClick}
                />
            ))}
        </div>,
        portalTarget
    )
};

export default FloatingMenu;