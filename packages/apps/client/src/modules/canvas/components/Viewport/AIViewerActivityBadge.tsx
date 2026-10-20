import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

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
        <div className='pointer-events-none absolute left-1/2 top-3 z-[12] flex -translate-x-1/2 flex-row items-center gap-1 rounded-full px-3 py-1.5 text-white backdrop-blur-[6px] bg-[linear-gradient(90deg,rgba(99,102,241,0.92),rgba(139,92,246,0.92))] shadow-[0_4px_16px_rgba(79,70,229,0.35)] animate-[ai-viewer-badge-in_160ms_ease-out]'
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
