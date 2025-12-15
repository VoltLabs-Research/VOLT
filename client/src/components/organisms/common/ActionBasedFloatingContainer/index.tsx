/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import React from 'react';
import useFloatingContainer from '@/hooks/ui/positioning/use-floating-container';
import FloatingMenu from '@/components/molecules/common/FloatingMenu';
import type { FloatingContainerProps } from '@/types/floating-container';
import Container from '@/components/primitives/Container';
import './ActionBasedFloatingContainer.css';

interface ExtendedFloatingContainerProps extends FloatingContainerProps {
    useCursorPosition?: boolean;
    deleteMenuStyle?: boolean;
}

const ActionBasedFloatingContainer: React.FC<ExtendedFloatingContainerProps> = ({
    options,
    children,
    className,
    menuClassName,
    portalTarget,
    useCursorPosition = false,
    deleteMenuStyle = false,
}) => {
    const {
        triggerRef,
        menuRef,
        isVisible,
        styles,
        handleToggle,
        handleOptionClick,
    } = useFloatingContainer({ useCursorPosition });

    const finalMenuClassName = deleteMenuStyle
        ? `${menuClassName || ''} delete-menu-style`.trim()
        : menuClassName;

    return(
        <>
            <Container
                onClick={handleToggle}
                ref={triggerRef}
                className={className}
            >
                {children}
            </Container>

            <FloatingMenu
                isVisible={isVisible}
                menuRef={menuRef}
                styles={styles}
                options={options}
                onItemClick={handleOptionClick}
                className={finalMenuClassName}
                portalTarget={portalTarget}
                deleteMenuStyle={deleteMenuStyle}
            />
        </>
    );
};

export default ActionBasedFloatingContainer;
