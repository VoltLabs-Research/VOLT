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

import { useEffect, useRef, useMemo } from 'react';
import AnimationPresenceManager, { type AnimationConfig } from '@/utilities/animations/animation-presence-manager';

const DEFAULT_ANIMATION_DURATION = 300;
const ANIMATION_EASING = 'ease-in-out';
const FADE_OUT_EASING = 'ease-out';

interface UseAnimationPresenceOptions {
    duration?: number;
    easing?: string;
    fadeOutEasing?: string;
}

const useAnimationPresence = (options: UseAnimationPresenceOptions = {}) => {
    const elementRef = useRef<HTMLElement | null>(null);
    const animationManagerRef = useRef<AnimationPresenceManager | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    const config = useMemo((): AnimationConfig => ({
        duration: options.duration ?? DEFAULT_ANIMATION_DURATION,
        easing: options.easing ?? ANIMATION_EASING,
        fadeOutEasing: options.fadeOutEasing ?? FADE_OUT_EASING,
    }), [options.duration, options.easing, options.fadeOutEasing]);

    useEffect(() => {
        const node = elementRef.current;
        if(!node){
            if(observerRef.current) observerRef.current.disconnect();
            if(animationManagerRef.current) animationManagerRef.current.cleanup();

            animationManagerRef.current = null;
            observerRef.current = null;

            return;
        }

        if(animationManagerRef.current){
            animationManagerRef.current.cleanup();
            if(observerRef.current) observerRef.current.disconnect();
        }

        node.style.position = 'relative';

        const animationManager = new AnimationPresenceManager(config);
        animationManagerRef.current = animationManager;

        animationManager.recordPositions(node);

        const observer = new MutationObserver((mutations) => {
            animationManager.handleMutations(mutations, node);
        });
        observerRef.current = observer;

        observer.observe(node, { childList: true });
        return() => {
            if(observerRef.current) observerRef.current.disconnect();
            if(animationManagerRef.current) animationManagerRef.current.cleanup();
        };
    }, [config]);

    return [elementRef];
};

export default useAnimationPresence;
