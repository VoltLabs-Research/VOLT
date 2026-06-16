import { useMemo } from 'react';
import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { resolveBondLineSettings, shouldRenderBonds } from '@/modules/fractal/services/bond-render';
import { warnFractal } from '@/modules/fractal/utilities/debug-log';

import type { ComponentProps, FC } from 'react';

type BondsModelViewerProps = ComponentProps<typeof SingleModelViewer> & {
    bondCount?: number;
    bondRadius?: number;
    bondWidthOverride?: number;
};

const BondsModelViewer: FC<BondsModelViewerProps> = ({
    bondCount,
    bondRadius,
    bondWidthOverride,
    lineSettings,
    ...singleModelViewerProps
}) => {
    const resolvedLineSettings = useMemo(
        () => lineSettings ?? resolveBondLineSettings({ radius: bondRadius }, bondWidthOverride),
        [lineSettings, bondRadius, bondWidthOverride]
    );

    const count = bondCount ?? 0;
    const canRender = count === 0 || shouldRenderBonds(count);

    if (!canRender) {
        warnFractal('bonds.render-skipped-over-budget', {
            bondCount: count,
            sceneKey: singleModelViewerProps.sceneConfig
                ? `${singleModelViewerProps.sceneConfig.source}`
                : undefined
        });
        return null;
    }

    return (
        <SingleModelViewer
            {...singleModelViewerProps}
            lineSettings={resolvedLineSettings}
        />
    );
};

export default BondsModelViewer;
