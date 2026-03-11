declare module 'guacamole-common-js' {
    interface GuacamoleStatus {
        code: number;
        message: string;
    };

    interface MouseState {
        x: number;
        y: number;
        left: boolean;
        middle: boolean;
        right: boolean;
        up: boolean;
        down: boolean;
    };

    class WebSocketTunnel {
        constructor(url: string);
        onerror: ((status: GuacamoleStatus) => void) | null;
    }

    class Display {
        getElement(): HTMLElement;
    }

    class Client {
        constructor(tunnel: WebSocketTunnel);
        onerror: ((status: GuacamoleStatus) => void) | null;
        onstatechange: ((state: number) => void) | null;
        connect(data?: string): void;
        disconnect(): void;
        getDisplay(): Display;
        sendMouseState(state: MouseState): void;
        sendKeyEvent(pressed: number, keysym: number): void;
        sendSize(width: number, height: number): void;
    }

    class Mouse {
        constructor(element: HTMLElement);
        onmousedown: ((state: MouseState) => void) | null;
        onmouseup: ((state: MouseState) => void) | null;
        onmousemove: ((state: MouseState) => void) | null;
    }

    class Keyboard {
        constructor(element: Document | HTMLElement);
        onkeydown: ((keysym: number) => boolean | void) | null;
        onkeyup: ((keysym: number) => void) | null;
    }

    interface GuacamoleLibrary {
        WebSocketTunnel: typeof WebSocketTunnel;
        Client: typeof Client;
        Mouse: typeof Mouse;
        Keyboard: typeof Keyboard;
    };

    const Guacamole: GuacamoleLibrary;
    export default Guacamole;
}
