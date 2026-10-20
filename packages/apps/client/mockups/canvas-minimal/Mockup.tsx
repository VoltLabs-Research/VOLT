import preview from './preview.png';
import { Button, Chip, Kbd, SearchField, Separator, Slider, cn } from '@heroui/react';
import { ChevronLeft, Ellipsis, Moon, Play, Plus, Search, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ObjectKey = 'particles' | 'cell' | 'ptm08' | 'ptm10' | 'acna';

interface RailObject {
    key: ObjectKey;
    label: string;
    count: string;
    dangling?: string;
    kind: 'scene' | 'analysis';
    progress?: number;
}

const OBJECTS: RailObject[] = [
    { key: 'particles', label: 'Particles', count: '6.1 M', kind: 'scene' },
    { key: 'cell', label: 'Cell', count: '1 × 1 × 1', kind: 'scene' },
    { key: 'ptm08', label: 'PTM 0.08 → DXA', count: '302', dangling: '0.31', kind: 'analysis' },
    { key: 'ptm10', label: 'PTM 0.10 → DXA', count: '1 826', dangling: '0.42', kind: 'analysis', progress: 62 },
    { key: 'acna', label: 'ACNA → DXA', count: '4 653', dangling: '0.46', kind: 'analysis' }
];

const COMMANDS = [
    ['Run Polyhedral Template Matching', 'Plugin', 'P'],
    ['Run Adaptive Common Neighbor Analysis', 'Plugin', ''],
    ['Screenshot 4K', 'Capture', 'S'],
    ['Render settings', 'View', 'R'],
    ['Frame camera to selection', 'View', 'F'],
    ['Share', 'Trajectory', ''],
    ['Download frame dump', 'Trajectory', ''],
    ['Toggle theme', 'App', 'T']
] as const;

const glass = 'canvas-viewport-floating-controls bg-chrome border border-border rounded-xl';

const useTheme = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'));
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const;
};

const Rail = ({ selected, onSelect, onAdd }: { selected: ObjectKey | null; onSelect: (key: ObjectKey) => void; onAdd: () => void }) => (
    <aside className={cn(glass, 'absolute left-3 top-14 z-[5] flex w-[196px] flex-col p-1.5')} aria-label='Objects'>
        {OBJECTS.map((object) => (
            <button
                key={object.key}
                type='button'
                onClick={() => onSelect(object.key)}
                className={cn(
                    'flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left text-xs text-foreground transition-colors duration-150 hover:bg-surface-hover',
                    selected === object.key && 'bg-surface-tertiary'
                )}
            >
                <span
                    className={cn('size-2 shrink-0', object.kind === 'scene' ? 'rounded-full border border-foreground' : 'rounded-[2px] bg-foreground')}
                    style={object.progress ? { opacity: 0.55 } : undefined}
                    aria-hidden='true'
                />
                <span className='min-w-0 flex-1 truncate'>{object.label}</span>
                {object.progress ? (
                    <Chip color='default' variant='soft' size='sm' className='shrink-0'>
                        <Chip.Label>{object.progress} %</Chip.Label>
                    </Chip>
                ) : (
                    <span className='shrink-0 font-mono text-2xs text-muted tabular-nums'>{object.count}</span>
                )}
            </button>
        ))}
        <Separator className='my-1 bg-border' />
        <Button variant='ghost' size='sm' className='justify-start gap-2 px-2 text-xs text-muted' onPress={onAdd}>
            <Plus size={14} aria-hidden='true' />
            Add analysis
            <Kbd className='ml-auto text-2xs'>⌘K</Kbd>
        </Button>
    </aside>
);

const Inspector = ({ object, onClose }: { object: RailObject; onClose: () => void }) => (
    <aside className={cn(glass, 'absolute right-3 top-14 z-[5] flex w-[240px] flex-col')} aria-label={`${object.label} inspector`}>
        <div className='flex h-9 items-center justify-between border-b border-border pl-3 pr-1'>
            <span className='truncate text-xs font-medium text-foreground'>{object.label}</span>
            <Button variant='ghost' size='sm' isIconOnly aria-label='Close inspector' onPress={onClose}>
                <X size={14} aria-hidden='true' />
            </Button>
        </div>
        {object.kind === 'analysis' && (
            <dl className='m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-3 py-2.5 text-xs'>
                <dt className='text-muted'>Segments</dt>
                <dd className='m-0 font-mono text-foreground tabular-nums'>{object.count}</dd>
                <dt className='text-muted'>Dangling fraction</dt>
                <dd className='m-0 font-mono text-foreground tabular-nums'>{object.dangling}</dd>
                <dt className='text-muted'>Color by</dt>
                <dd className='m-0 text-foreground'>Burgers family</dd>
            </dl>
        )}
        {object.kind === 'scene' && (
            <dl className='m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-3 py-2.5 text-xs'>
                <dt className='text-muted'>Atoms</dt>
                <dd className='m-0 font-mono text-foreground tabular-nums'>6 134 208</dd>
                <dt className='text-muted'>Color by</dt>
                <dd className='m-0 text-foreground'>Structure type</dd>
            </dl>
        )}
        <div className='flex flex-col gap-3 border-t border-border px-3 py-3'>
            <label className='flex flex-col gap-1.5 text-xs text-muted'>
                <span className='flex justify-between'>{object.kind === 'analysis' ? 'Line width' : 'Point size'}<span className='font-mono tabular-nums'>{object.kind === 'analysis' ? '1.6 Å' : '0.9'}</span></span>
                <Slider aria-label={object.kind === 'analysis' ? 'Line width' : 'Point size'} minValue={0} maxValue={4} step={0.1} defaultValue={object.kind === 'analysis' ? 1.6 : 0.9} size='sm'>
                    <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
                </Slider>
            </label>
            <label className='flex flex-col gap-1.5 text-xs text-muted'>
                <span className='flex justify-between'>{object.kind === 'analysis' ? 'Mesh opacity' : 'Opacity'}<span className='font-mono tabular-nums'>{object.kind === 'analysis' ? '0.05' : '1.00'}</span></span>
                <Slider aria-label='Opacity' minValue={0} maxValue={1} step={0.01} defaultValue={object.kind === 'analysis' ? 0.05 : 1} size='sm'>
                    <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
                </Slider>
            </label>
        </div>
        <div className='flex items-center gap-1 border-t border-border p-1'>
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Results</Button>
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Log</Button>
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Download</Button>
        </div>
    </aside>
);

const Palette = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    if (!open) return null;
    return (
        <div className='absolute inset-0 z-[10] flex justify-center bg-black/25 pt-16' onClick={onClose} role='presentation'>
            <div
                className='flex h-fit w-[min(520px,88%)] flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-surface'
                role='dialog'
                aria-label='Commands'
                onClick={(event) => event.stopPropagation()}
            >
                <SearchField aria-label='Search commands' autoFocus>
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder='Plugin, setting or action…' />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <ul className='m-0 flex list-none flex-col gap-0.5 p-0'>
                    {COMMANDS.map(([label, category, key], index) => (
                        <li
                            key={label}
                            className={cn('flex items-center justify-between rounded-lg px-3 py-2', index === 0 && 'bg-surface-tertiary')}
                        >
                            <span className='flex flex-col'>
                                <span className='text-sm text-foreground'>{label}</span>
                                <span className='text-xs text-muted'>{category}</span>
                            </span>
                            {key && <Kbd className='text-xs'>{key}</Kbd>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const Timeline = () => (
    <div
        className={cn(glass, 'group absolute inset-x-3 bottom-3 z-[5] flex h-[30px] flex-col overflow-hidden transition-[height] duration-150 hover:h-[76px] focus-within:h-[76px]')}
        tabIndex={0}
        aria-label='Timeline'
    >
        <div className='flex h-[30px] shrink-0 items-center gap-2 px-1.5'>
            <Button variant='ghost' size='sm' isIconOnly aria-label='Play'>
                <Play size={13} aria-hidden='true' />
            </Button>
            <div className='relative h-0.5 flex-1 rounded-full bg-border-secondary'>
                <span className='absolute -top-1 left-[31%] size-2.5 rounded-full bg-foreground' aria-hidden='true' />
            </div>
            <span className='font-mono text-xs text-muted tabular-nums'>850 000 / 2</span>
        </div>
        <div className='flex items-center justify-between px-3 pb-2 text-xs text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100'>
            <span className='font-mono tabular-nums'>550 000</span>
            <span className='mx-3 h-3 flex-1 bg-[repeating-linear-gradient(90deg,var(--border-secondary)_0_1px,transparent_1px_7.6%)]' aria-hidden='true' />
            <span className='font-mono tabular-nums'>850 000</span>
            <Separator orientation='vertical' className='mx-3 h-3 w-px bg-border' />
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Cell</Button>
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Particles</Button>
            <Button variant='ghost' size='sm' className='text-xs text-muted'>Download</Button>
        </div>
    </div>
);

const Screen = ({ selected, onSelect, paletteOpen, onPalette }: {
    selected: ObjectKey | null;
    onSelect: (key: ObjectKey | null) => void;
    paletteOpen: boolean;
    onPalette: (open: boolean) => void;
}) => {
    const object = OBJECTS.find((entry) => entry.key === selected) ?? null;
    return (
        <div className='relative aspect-[16/9.4] w-full overflow-hidden rounded-xl border border-border-secondary bg-surface select-none'>
            <img src={preview} alt='' className='absolute inset-0 h-full w-full object-cover' draggable={false} />

            <header className='absolute inset-x-0 top-0 z-[5] flex h-11 items-center gap-1 px-2'>
                <Button variant='ghost' size='sm' isIconOnly aria-label='Back to folder'>
                    <ChevronLeft size={16} aria-hidden='true' />
                </Button>
                <span className='min-w-0 truncate px-1 text-xs leading-6 text-foreground'>
                    nano-scratch with SRO
                    <span className='text-muted'> · 6.1 M atoms · 850 000</span>
                </span>
                <span className='flex-1' />
                <span className='flex items-center pr-1' aria-label='2 collaborators'>
                    <span className='size-5 rounded-full border-[1.5px] border-surface bg-surface-tertiary' />
                    <span className='-ml-1.5 size-5 rounded-full border-[1.5px] border-surface bg-surface-tertiary' />
                </span>
                <Button variant='ghost' size='sm' isIconOnly aria-label='Share, rename and more'>
                    <Ellipsis size={16} aria-hidden='true' />
                </Button>
            </header>

            <Rail selected={selected} onSelect={(key) => onSelect(selected === key ? null : key)} onAdd={() => onPalette(true)} />

            {object ? (
                <Inspector object={object} onClose={() => onSelect(null)} />
            ) : (
                <button
                    type='button'
                    onClick={() => onPalette(true)}
                    className={cn(glass, 'absolute right-3 top-14 z-[5] flex h-8 cursor-pointer items-center gap-2 px-3 text-xs text-muted transition-colors duration-150 hover:text-foreground')}
                >
                    <Search size={13} aria-hidden='true' />
                    Plugins, render, capture…
                    <Kbd className='text-2xs'>⌘K</Kbd>
                </button>
            )}

            <Timeline />
            <Palette open={paletteOpen} onClose={() => onPalette(false)} />
        </div>
    );
};

const Mockup = () => {
    const [theme, toggleTheme] = useTheme();
    const [selected, setSelected] = useState<ObjectKey | null>(null);
    const [paletteOpen, setPaletteOpen] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPaletteOpen(false);
                setSelected(null);
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <main className='mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col gap-6 bg-background px-5 py-10 text-foreground'>
            <div className='flex flex-wrap items-end justify-between gap-4'>
                <div className='flex flex-col gap-1'>
                    <span className='text-2xs font-medium uppercase tracking-[0.08em] text-muted'>VOLT · canvas · propuesta</span>
                    <h1 className='m-0 text-2xl font-semibold tracking-tight text-foreground'>Canvas mínimo</h1>
                    <p className='m-0 max-w-[62ch] text-sm text-muted'>
                        Los componentes son los de VOLT: HeroUI, los tokens de <code className='font-mono text-xs'>index.css</code> y las superficies translúcidas del canvas.
                        El viewport es el render real de la trayectoria.
                    </p>
                </div>
                <div className='flex items-center gap-1'>
                    <Button variant={selected === null && !paletteOpen ? 'secondary' : 'ghost'} size='sm' className='text-xs' onPress={() => { setSelected(null); setPaletteOpen(false); }}>En reposo</Button>
                    <Button variant={selected !== null ? 'secondary' : 'ghost'} size='sm' className='text-xs' onPress={() => { setSelected('acna'); setPaletteOpen(false); }}>Objeto elegido</Button>
                    <Button variant={paletteOpen ? 'secondary' : 'ghost'} size='sm' className='text-xs' onPress={() => setPaletteOpen(true)}>⌘K</Button>
                    <Separator orientation='vertical' className='mx-1 h-4 w-px bg-border' />
                    <Button variant='ghost' size='sm' isIconOnly aria-label='Toggle theme' onPress={toggleTheme}>
                        {theme === 'dark' ? <Sun size={15} aria-hidden='true' /> : <Moon size={15} aria-hidden='true' />}
                    </Button>
                </div>
            </div>

            <Screen selected={selected} onSelect={setSelected} paletteOpen={paletteOpen} onPalette={setPaletteOpen} />

            <div className='grid grid-cols-1 gap-x-10 gap-y-2 text-sm text-muted md:grid-cols-3'>
                <p className='m-0'><span className='text-foreground'>En reposo</span>: viewport, nombre con átomos y frame, raíl de seis filas, franja de tiempo de 30 px y el botón que anuncia <Kbd className='text-2xs'>⌘K</Kbd>.</p>
                <p className='m-0'><span className='text-foreground'>Con un objeto elegido</span>: inspector a la derecha con sus cifras, dos ajustes y tres enlaces. Se cierra con <Kbd className='text-2xs'>Esc</Kbd>.</p>
                <p className='m-0'><span className='text-foreground'>Todo lo demás</span> vive en la paleta: plugins, render, captura, compartir, descargas y tema.</p>
            </div>
        </main>
    );
};

export default Mockup;
