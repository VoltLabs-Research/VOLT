import { useLocation } from 'react-router-dom';
import { WASM_CANVAS_PATH } from './constants';

export const useIsWasmCanvas = (): boolean => {
    return useLocation().pathname === WASM_CANVAS_PATH;
};
