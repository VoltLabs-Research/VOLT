import React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import './WindowIcons.css';

type IconDef = {
    variant: 'close' | 'minimize' | 'expand';
    title: string;
};

const ICONS: IconDef[] = [{
    variant: 'close',
    title: 'Close'
}, {
    variant: 'minimize',
    title: 'Minimize'
}, {
    variant: 'expand',
    title: 'Expand'
}];

const IconCircle = ({ variant, title }: IconDef) => {
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

    return (
        <motion.div
            className={`window-icon-circle ${variant}`}
            title={title}
            role="button"
            tabIndex={0}
            onMouseMove={onMove}
            onHoverStart={() => scaleMv.set(1.35)}
            onHoverEnd={() => scaleMv.set(1)}
            style={{ originX, originY, scale }}
            whileTap={{ scale: 0.92 }}  
        />
    );
};

const WindowIcons: React.FC = () => {

    return (
        <div
            className='window-icons-container'
            role='toolbar'
            aria-label='Window controls'
        >
            {ICONS.map((icon) => (
                <IconCircle key={icon.variant} {...icon} />
            ))}
        </div>
    );
};

export default WindowIcons;