import { useEffect, useRef, useMemo } from 'react';
import AnimationPresenceManager, { type AnimationConfig } from '@/utilities/animation-presence-manager';

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
        return () => {
            if(observerRef.current) observerRef.current.disconnect();
            if(animationManagerRef.current) animationManagerRef.current.cleanup();
        };
    }, [config, elementRef.current]);

    return [elementRef];
};

export default useAnimationPresence;