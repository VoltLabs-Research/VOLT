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

import { useCallback, useRef } from 'react';

const useAnimationPresence = () => {
    const positions = useRef(new Map()).current;
    const timeoutId = useRef(null);
    const animationDuration = 300;

    const ref = useCallback((node) => {
        if (!node) {
            return;
        }

        node.style.position = 'relative';

        const recordPositions = () => {
            positions.clear();
            for (const child of node.children) {
                if (child.nodeType === 1) {
                    positions.set(child, child.getBoundingClientRect());
                }
            }
        };

        recordPositions();

        const observer = new MutationObserver((mutations) => {
            const animations = [];
            const newRects = new Map();
            const parentRect = node.getBoundingClientRect();

            for (const child of node.children) {
                if (child.nodeType === 1) {
                    newRects.set(child, child.getBoundingClientRect());
                }
            }

            for (const mutation of mutations) {
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode.nodeType !== 1) continue;

                    const oldRect = positions.get(removedNode);
                    if (!oldRect) continue;

                    removedNode.style.position = 'absolute';
                    removedNode.style.top = `${oldRect.top - parentRect.top}px`;
                    removedNode.style.left = `${oldRect.left - parentRect.left}px`;
                    removedNode.style.width = `${oldRect.width}px`;
                    removedNode.style.height = `${oldRect.height}px`;
                    node.appendChild(removedNode);

                    requestAnimationFrame(() => {
                        removedNode.style.pointerEvents = 'none';
                        removedNode.style.transition = `opacity ${animationDuration}ms ease-out`;
                        removedNode.style.opacity = '0';
                        
                        removedNode.addEventListener('transitionend', () => {
                            try {
                                if (removedNode.parentNode === node) {
                                    node.removeChild(removedNode);
                                }
                            } catch (e) {}
                        }, { once: true });
                    });
                }

                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType !== 1 || addedNode.style.position === 'absolute') continue;

                    addedNode.style.opacity = '0';
                    addedNode.style.transform = 'scale(0.98)';
                    
                    animations.push(() => {
                        addedNode.style.transition = `all ${animationDuration}ms ease-in-out`;
                        addedNode.style.opacity = '1';
                        addedNode.style.transform = 'scale(1)';
                    });
                }
            }

            for (const [element, newRect] of newRects.entries()) {
                const oldRect = positions.get(element);
                if (oldRect && newRect) {
                    const deltaX = oldRect.left - newRect.left;
                    const deltaY = oldRect.top - newRect.top;

                    if (deltaX !== 0 || deltaY !== 0) {
                        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                        element.style.transition = 'none';

                        animations.push(() => {
                            element.style.transition = `transform ${animationDuration}ms ease-in-out`;
                            element.style.transform = 'none';
                        });
                    }
                }
            }

            requestAnimationFrame(() => {
                animations.forEach((animate) => animate());
                
                if (timeoutId.current) {
                    clearTimeout(timeoutId.current);
                }

                timeoutId.current = setTimeout(() => {
                    for (const child of node.children) {
                        if (child.nodeType === 1 && child.style.position !== 'absolute') {
                            child.style.transition = '';
                            child.style.transform = '';
                        }
                    }
                    recordPositions();
                }, animationDuration);
            });
        });

        observer.observe(node, { childList: true });

        return () => {
            observer.disconnect();
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
            }
            positions.clear();
        };
    }, [animationDuration]);

    return [ref];
};

export default useAnimationPresence;