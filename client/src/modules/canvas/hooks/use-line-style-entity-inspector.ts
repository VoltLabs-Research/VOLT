import lineStyleService from '@/modules/trajectory/api/services/line-style-service';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { parseNumericInput } from '../utils/parse-numeric-input';
import { useCallback, useState } from 'react';

import type { GetLineEntityPropertiesResponse } from '@volt/contracts/modules/trajectory/domain';
import type { LineStyleTarget } from '../utils/line-style-spec';

/**
 * Looks up every property the daemon recorded for a single line entity, so the
 * editor can show what a rendered tube actually represents.
 */
const useLineStyleEntityInspector = (target: LineStyleTarget | null) => {
    const [entityIdInput, setEntityIdInput] = useState('');
    const [inspectedEntity, setInspectedEntity] = useState<GetLineEntityPropertiesResponse | null>(null);
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);

    const handleInspect = useCallback(async () => {
        if (!target) {
            setInspectError('Add a line result to the scene first');
            return;
        }

        const entityId = parseNumericInput(entityIdInput);
        if (entityId === null) {
            setInspectError('Enter a numeric entity id');
            return;
        }

        setInspectError(null);
        setIsInspecting(true);
        try {
            setInspectedEntity(await lineStyleService.getEntityProperties({
                ...target,
                entityId
            }));
        } catch (lookupError: unknown) {
            setInspectedEntity(null);
            setInspectError(reportError(lookupError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: `Entity ${entityId} not found`
            }).title);
        } finally {
            setIsInspecting(false);
        }
    }, [target, entityIdInput]);

    return {
        entityIdInput,
        setEntityIdInput,
        handleInspect,
        isInspecting,
        inspectedEntity,
        inspectError
    };
};

export default useLineStyleEntityInspector;
