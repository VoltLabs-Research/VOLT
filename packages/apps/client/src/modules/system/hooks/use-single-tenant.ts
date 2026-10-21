import { deploymentConfigQuery } from '@/modules/system/hooks/queries';
import { useIsWasmCanvas } from '@/modules/canvas-wasm/use-is-wasm-canvas';

export const useSingleTenant = (): boolean => {
    const isWasmCanvas = useIsWasmCanvas();
    return deploymentConfigQuery(undefined, { staleTime: Infinity, enabled: !isWasmCanvas }).data?.mode === 'local';
};
