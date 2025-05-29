// Types for Three.js components in React Three Fiber
declare global {
    namespace JSX {
        interface IntrinsicElements {
            ambientLight: {
                intensity?: number;
                color?: string;
            };
            directionalLight: {
                intensity?: number;
                position?: [number, number, number];
                color?: string;
                castShadow?: boolean;
                'shadow-mapSize'?: [number, number];
                'shadow-camera-far'?: number;
                'shadow-camera-left'?: number;
                'shadow-camera-right'?: number;
                'shadow-camera-top'?: number;
                'shadow-camera-bottom'?: number;
            };
            mesh: any;
        }
    }
}

export {};
