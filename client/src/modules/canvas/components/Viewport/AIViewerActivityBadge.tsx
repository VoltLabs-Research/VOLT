import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import './AIViewerActivityBadge.css';

const AIViewerActivityBadge = () => {
    const aiActingUntil = useCanvasBridgeStore((state) => state.aiActingUntil);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const remaining = aiActingUntil - Date.now();
        if (remaining <= 0) {
            setVisible(false);
            return;
        }

        setVisible(true);
        const timer = window.setTimeout(() => setVisible(false), remaining);
        return () => window.clearTimeout(timer);
    }, [aiActingUntil]);

    if (!visible) {
        return null;
    }

    return (
        <div className='flex flex-row items-center gap-1 absolute ai-viewer-activity-badge'
            aria-live='polite'
        >
            <Sparkles size={14} />
            <span className='text-xs font-medium'>
                Volt AI is adjusting the view
            </span>
        </div>
    );
};

export default AIViewerActivityBadge;
