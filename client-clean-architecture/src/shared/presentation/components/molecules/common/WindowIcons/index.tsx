import React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import '@/shared/presentation/components/molecules/common/WindowIcons/WindowIcons.css';
import Container from '@/shared/presentation/components/primitives/Container';

type IconDef = {
    variant: 'close' | 'minimize' | 'expand';
    title: string;
    onClick: () => void;
};

const IconCircle = ({ variant, title, onClick }: IconDef) => {
    const originX = useMotionValue(0.5);
    const originY = useMotionValue(0.5);
    const scaleMv = useMotionValue(1);

    const scale = useSpring(scaleMv, {
        stiffness: 320,
        damping: 24,
        mass: 0.6
    });

    const onMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / rect.width;
        const ry = (e.clientY - rect.top) / rect.height;

        originX.set(1 - rx);
        originY.set(1 - ry);
    };

    const handleClick = (e: React.MouseEvent) => {
        console.log('WindowIcons handleClick called', variant);
        e.stopPropagation();
        e.preventDefault();
        onClick();
    };

    return(
        <motion.div
            className={`window-icon-circle ${variant} p-relative cursor-pointer`}
            title={title}
            role="button"
            onClick={handleClick}
            onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
            tabIndex={0}
            onMouseMove={onMove}
            onHoverStart={() => scaleMv.set(1.35)}
            onHoverEnd={() => scaleMv.set(1)}
            style={{ originX, originY, scale }}
            whileTap={{ scale: 0.92 }}
        />
    );
};

interface WindowIconsProps {
    withBackground?: boolean;
    onClose?: () => void;
    onExpand?: () => void;
    onMinimize?: () => void;
}

const WindowIcons: React.FC<WindowIconsProps> = ({
    withBackground = false,
    onClose = () => { },
    onExpand,
    onMinimize
}) => {
    const ICONS: IconDef[] = [{
        variant: 'close',
        title: 'Close',
        onClick: onClose
    }, {
        variant: 'minimize',
        title: 'Minimize',
        onClick: onMinimize || (() => { })
    }, {
        variant: 'expand',
        title: 'Expand',
        onClick: onExpand || (() => { })
    }];

    return(
        <Container
            className={`window-icons-container d-flex items-center ${withBackground ? 'with-background' : ''}`}
            role='toolbar'
            aria-label='Window controls'
        >
            {ICONS.map((icon) => (
                <IconCircle
                    key={icon.variant} {...icon} />
            ))}
        </Container>
    );
};

export default WindowIcons;
