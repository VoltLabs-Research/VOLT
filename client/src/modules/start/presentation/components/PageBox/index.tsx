import { useRef, useCallback, useState, useEffect } from 'react';
import type { AccessedPage } from '@/shared/presentation/stores/use-accessed-pages-store';
import { useAccessedPagesStore } from '@/shared/presentation/stores/use-accessed-pages-store';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fadeToBlack } from '@/shared/presentation/utilities/page-transition';

const IFRAME_W = 1280;
const IFRAME_H = 800;

interface PageBoxProps {
    page: AccessedPage;
}

const TILT_MAX = 8;
const SCALE_HOVER = 1.03;

const PageBox = ({ page }: PageBoxProps) => {
    const removePage = useAccessedPagesStore((state) => state.removePage);
    const navigate = useNavigate();
    const tileRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const isAnimating = useRef(false);
    const [iframeScale, setIframeScale] = useState(1);

    useEffect(() => {
        const tile = tileRef.current;
        if (!tile) return;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            const scale = Math.max(width / IFRAME_W, height / IFRAME_H);
            setIframeScale(scale);
        });

        observer.observe(tile);
        return () => observer.disconnect();
    }, []);

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        removePage(page.path);
    };

    const handleClick = async () => {
        if (isAnimating.current) return;
        isAnimating.current = true;

        await fadeToBlack();
        navigate(page.path);
    };

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const tile = tileRef.current;
        if (!tile) return;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
            const rect = tile.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const normalX = (x - centerX) / centerX;
            const normalY = (y - centerY) / centerY;

            const rotateY = normalX * TILT_MAX;
            const rotateX = -normalY * TILT_MAX;

            tile.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${SCALE_HOVER}, ${SCALE_HOVER}, 1)`;

            const percentX = (x / rect.width) * 100;
            const percentY = (y / rect.height) * 100;
            tile.style.setProperty('--mouse-x', `${percentX}%`);
            tile.style.setProperty('--mouse-y', `${percentY}%`);
        });
    }, []);

    const handleMouseLeave = useCallback(() => {
        const tile = tileRef.current;
        if (!tile) return;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        tile.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        tile.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

        setTimeout(() => {
            if (tile) tile.style.transition = '';
        }, 600);
    }, []);

    const handleMouseEnter = useCallback(() => {
        const tile = tileRef.current;
        if (!tile) return;
        tile.style.transition = '';
    }, []);

    const timeAgo = Math.floor((Date.now() - page.lastAccessed) / 60000);
    const timeString = timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`;

    return (
        <div
            ref={tileRef}
            className="metro-tile"
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
        >
            {page.snapshot && (
                <div
                    className="metro-tile-preview-container"
                    style={{ transform: `scale(${iframeScale})` }}
                >
                    <iframe
                        srcDoc={page.snapshot}
                        sandbox=""
                        className="metro-tile-iframe"
                        scrolling="no"
                        tabIndex={-1}
                    />
                </div>
            )}

            <div className="metro-tile-shine" />

            <div className="metro-tile-overlay">
                <h3 className="metro-tile-name">{page.title}</h3>
                <span className="metro-tile-time">{timeString}</span>
            </div>

            <button
                onClick={handleRemove}
                title="Remove from history"
                className="metro-tile-close"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default PageBox;
