import Logger from '@/services/common/logger';

export interface ElementRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface AnimationConfig {
    duration: number;
    easing: string;
    fadeOutEasing: string;
}

export interface ElementAnimation {
    element: HTMLElement;
    animation: () => void;
}

class AnimationPresenceManager{
    private positions = new Map<Element, ElementRect>();
    private timeoutId: number | null = null;
    private config: AnimationConfig;
    private readonly logger: Logger = new Logger('animation-presence-manager');

    constructor(config: AnimationConfig){
        this.config = config;
    }

    recordPositions(container: HTMLElement): void{
        this.positions.clear();
        for(const child of container.children){
            if(this.isValidElement(child)){
                this.positions.set(child, child.getBoundingClientRect());
            }
        }
    }

    private isValidElement(node: Node): node is HTMLElement{
        return node.nodeType === Node.ELEMENT_NODE;
    }

    private createFadeOutAnimation(
        element: HTMLElement,
        rect: ElementRect,
        container: HTMLElement
    ): void{
        const containerRect = container.getBoundingClientRect();

        // Position element absolutely for fade out
        Object.assign(element.style, {
            position: 'absolute',
            top: `${rect.top - containerRect.top}px`,
            left: `${rect.left - containerRect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            pointerEvents: 'none',
            transition: `opacity ${this.config.duration}ms ${this.config.fadeOutEasing}`,
            opacity: '0'
        });

        container.appendChild(element);

        element.addEventListener('transitionend', () => {
            this.safeRemoveElement(element, container);
        }, { once: true });
    }

    private createFadeInAnimation(element: HTMLElement): () => void{
        element.style.opacity = '0';
        element.style.transform = 'scale(0.98)';

        return() => {
            Object.assign(element.style, {
                transition: `all ${this.config.duration}ms ${this.config.easing}`,
                opacity: '1',
                transform: 'scale(1)'
            });
        };
    }

    private createMoveAnimation(
        element: HTMLElement,
        oldRect: ElementRect,
        newRect: ElementRect
    ): any{
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;

        if(deltaX === 0 && deltaY === 0){
            return null;
        }

        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        element.style.transition = 'none';

        return() => {
            Object.assign(element.style, {
                transition: `transform ${this.config.duration}ms ${this.config.easing}`,
                transform: 'none'
            });
        };
    }

    private safeRemoveElement(element: HTMLElement, container: HTMLElement): void{
        try{
            if(element.parentNode === container){
                container.removeChild(element);
            }
        }catch(err){
            this.logger.warn('Failed to remove animated element:', err);
        }
    }

    private clearStyles(container: HTMLElement): void{
        for(const child of container.children){
            if(this.isValidElement(child) && child.style.position !== 'absolute'){
                child.style.transition = '';
                child.style.transform = '';
            }
        }
    }

    handleMutations(mutations: MutationRecord[], container: HTMLElement): void{
        const animations: ElementAnimation[] = [];
        const newRects = this.getCurrentRects(container);

        this.handleRemovedNodes(mutations, container);
        this.handleAddedNodes(mutations, animations);
        this.handleMovedNodes(newRects, animations);
        this.executeAnimations(animations, container);
    }

    private getCurrentRects(container: HTMLElement): Map<Element, ElementRect>{
        const rects = new Map<Element, ElementRect>();
        for(const child of container.children){
            if(this.isValidElement(child)){
                rects.set(child, child.getBoundingClientRect());
            }
        }
        return rects;
    }

    private handleRemovedNodes(mutations: MutationRecord[], container: HTMLElement): void{
        for(const mutation of mutations){
            for(const removedNode of mutation.removedNodes){
                if(!this.isValidElement(removedNode)) continue;

                const oldRect = this.positions.get(removedNode);
                if(oldRect){
                    requestAnimationFrame(() => {
                        this.createFadeOutAnimation(removedNode, oldRect, container);
                    });
                }
            }
        }
    }

    private handleAddedNodes(mutations: MutationRecord[], animations: ElementAnimation[]): void{
        for(const mutation of mutations){
            for(const addedNode of mutation.addedNodes){
                if(!this.isValidElement(addedNode) || addedNode.style.position === 'absolute'){
                    continue;
                }

                const animation = this.createFadeInAnimation(addedNode);
                animations.push({ element: addedNode, animation });
            }
        }
    }

    private handleMovedNodes(
        newRects: Map<Element, ElementRect>,
        animations: ElementAnimation[]
    ): void{
        for(const [element, newRect] of newRects.entries()){
            if(!this.isValidElement(element)) continue;

            const oldRect = this.positions.get(element);
            if(oldRect){
                const animation = this.createMoveAnimation(element, oldRect, newRect);
                if(animation){
                    animations.push({ element, animation });
                }
            }
        }
    }

    private executeAnimations(animations: ElementAnimation[], container: HTMLElement): void{
        if(animations.length === 0) return;

        requestAnimationFrame(() => {
            animations.forEach(({ animation }) => animation());

            this.scheduleCleanup(container);
        });
    }

    private scheduleCleanup(container: HTMLElement): void{
        if(this.timeoutId){
            clearTimeout(this.timeoutId);
        }

        this.timeoutId = window.setTimeout(() => {
            this.clearStyles(container);
            this.recordPositions(container);
        }, this.config.duration);
    }

    cleanup(): void{
        if(this.timeoutId){
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        this.positions.clear();
    }
};

export default AnimationPresenceManager;
