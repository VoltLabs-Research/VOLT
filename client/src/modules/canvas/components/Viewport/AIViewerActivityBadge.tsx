import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import { Row, Text } from '@voltstack/bravais';
import { useEffect, useState } from 'react';
import { IoSparklesOutline } from 'react-icons/io5';
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
        <Row
            gap='025'
            align='center'
            position='absolute'
            className='ai-viewer-activity-badge'
            aria-live='polite'
        >
            <IoSparklesOutline size={14} />
            <Text as='span' size='sm' weight='medium'>
                Volt AI is adjusting the view
            </Text>
        </Row>
    );
};

export default AIViewerActivityBadge;
