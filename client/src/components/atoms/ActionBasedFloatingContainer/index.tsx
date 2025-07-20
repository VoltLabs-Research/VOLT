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

import { useEffect, useState, useRef } from 'react';
import './ActionBasedFloatingContainer.css';

const ActionBasedFloatingContainer = ({ options, children }: any) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [offset, setOffset] = useState({ top: '0px', right: '0px', left: '0px' });
    const [isVisible, setIsVisible] = useState(false);

    const handleOnClick = () => {
        if(!containerRef.current) return;
        const { top, right, left, height } = containerRef.current.getBoundingClientRect();
        const marginTop = 20;
        const topOffset = top + height + marginTop;

        setOffset({
            top: `${topOffset}px`,
            right: `${right}px`,
            left: `${left}px`,
        })
        setIsVisible(!isVisible);
    };

    useEffect(() => {
        const handleDocumentOnClick = (event: MouseEvent) => {
            if(containerRef.current && !containerRef.current.contains(event.target as Node)){
                setIsVisible(false);
            }
        };

        document.addEventListener('click', handleDocumentOnClick);

        return () => {
            document.removeEventListener('click', handleDocumentOnClick);
        };
    }, []);

    return (
        <>
            <div
                onClick={handleOnClick}
                ref={containerRef}
                className='action-based-floating-container-element-wrapper'
            >
                {children}
            </div>

            {isVisible && (
                <div 
                    style={offset}
                    className='action-based-floating-container'
                >
                    {options.map(([ name, Icon, onClick ], index) => (
                        <div className='action-based-floating-option-container' key={index} onClick={onClick}>
                            <i className='action-based-floating-option-icon-container'>
                                <Icon />
                            </i>

                            <span className='action-based-floating-option-name-container'>
                                {name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default ActionBasedFloatingContainer;