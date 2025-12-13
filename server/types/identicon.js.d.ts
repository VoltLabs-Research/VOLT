declare module 'identicon.js' {
    interface IdenticonOptions {
        foreground?: [number, number, number, number];
        background?: [number, number, number, number];
        margin?: number;
        size?: number;
        format?: 'svg' | 'png';
    }

    export default class Identicon{
        constructor(hash: string, options?: IdenticonOptions);
        toString(): string;
    }
}
