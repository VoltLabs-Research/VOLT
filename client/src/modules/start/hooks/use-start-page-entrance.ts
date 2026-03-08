import { useEffect } from 'react';
import type { RefObject } from 'react';

export const useStartPageEntrance = (
    wrapperRef: RefObject<HTMLDivElement | null>,
    pageCount: number
) => {
    useEffect(() => {
        const wrapper = wrapperRef.current;

        if (!wrapper) {
            return;
        }

        const tiles = Array.from(wrapper.querySelectorAll<HTMLElement>('.metro-tile'));
        const timeouts: number[] = [];

        tiles.forEach((tile, index) => {
            tile.style.opacity = '0';
            tile.style.transform = 'perspective(800px) translateX(80px) scale3d(0.92, 0.92, 1)';

            const entranceTimeout = window.setTimeout(() => {
                tile.style.transition = 'opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1), transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)';
                tile.style.opacity = '1';
                tile.style.transform = 'perspective(800px) translateX(0) scale3d(1, 1, 1)';

                const resetTimeout = window.setTimeout(() => {
                    tile.style.transition = '';
                }, 700);

                timeouts.push(resetTimeout);
            }, 100 + index * 120);

            timeouts.push(entranceTimeout);
        });

        return () => {
            timeouts.forEach(window.clearTimeout);
        };
    }, [pageCount, wrapperRef]);
};
