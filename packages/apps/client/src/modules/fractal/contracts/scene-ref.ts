export interface FractalSceneRef {
    zoomTo: (zoomPercent: number) => void;
    getCurrentZoom: () => number;
    resetCamera: () => void;
    subscribeZoom: (listener: (zoom: number) => void) => () => void;
}
