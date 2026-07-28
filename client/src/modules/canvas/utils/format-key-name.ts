const KEY_MAP: Record<string, string> = {
    ctrl: 'CTRL',
    control: 'CTRL',
    shift: '⇧',
    alt: '⌥',
    meta: '⌘',
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓',
    space: '␣',
    escape: 'Esc',
    enter: '↵',
    backspace: '⌫',
    delete: '⌦',
    tab: '⇥',
    home: 'Home',
    end: 'End',
    pageup: 'PgUp',
    pagedown: 'PgDn'
};

const formatKeyName = (key: string): string =>
    KEY_MAP[key.toLowerCase()] || key.toUpperCase();

export default formatKeyName;
