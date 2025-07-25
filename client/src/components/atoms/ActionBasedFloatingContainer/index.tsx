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

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ActionBasedFloatingContainer.css';

const ActionBasedFloatingContainer = ({ options, children }) => {
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [styles, setStyles] = useState({});

    const handleToggle = (e) => {
        e.stopPropagation();
        if (triggerRef.current) {
            const { top, left, height } = triggerRef.current.getBoundingClientRect();
            setStyles({
                position: 'fixed',
                top: `${top + height + 20}px`,
                left: `${left}px`,
            });
        }
        setIsVisible(prev => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                !triggerRef.current.contains(event.target)
            ) {
                setIsVisible(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleOptionClick = (originalOnClick, event) => {
        event.stopPropagation();

        if (typeof originalOnClick === 'function') {
            originalOnClick();
        }
        setIsVisible(false);
    };

    return (
        <>
            <div
                onClick={handleToggle}
                ref={triggerRef}
                className='action-based-floating-container-element-wrapper'
            >
                {children}
            </div>

            {isVisible && createPortal(
                <div
                    ref={menuRef}
                    style={styles}
                    className='action-based-floating-container'
                >
                    {options.map(([name, Icon, onClick], index) => (
                        <div
                            className='action-based-floating-option-container'
                            key={index}
                            onClick={(e) => handleOptionClick(onClick, e)}
                        >
                            <i className='action-based-floating-option-icon-container'>
                                <Icon />
                            </i>
                            <span className='action-based-floating-option-name-container'>
                                {name}
                            </span>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

export default ActionBasedFloatingContainer;