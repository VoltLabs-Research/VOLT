import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Heading, Text, TextInput, IconButton, CloseButton, LiquidToggle, Button } from '@voltstack/bravais';
import type { DevModeState } from '@/services/AppConfig';
import './DevModeModal.css';

interface DevModeModalProps{
    open: boolean;
    onClose: () => void;
    onApply: (payload: DevModeState) => void;
}

interface PathFieldProps{
    label: string;
    hint: string;
    value: string;
    onChange: (value: string) => void;
}

const PathField = ({ label, hint, value, onChange }: PathFieldProps) => {
    const browse = () =>
        window.volt.dialog.pickDirectory().then((picked) => { if(picked) onChange(picked); });

    return (
        <label className='dm-field'>
            <span className='dm-field-label'>{label}</span>
            <div className='dm-field-row'>
                <TextInput
                    fullWidth
                    value={value}
                    spellCheck={false}
                    placeholder={hint}
                    onChange={(event) => onChange(event.target.value)}
                />
                <IconButton type='button' variant='ghost' size='md' onClick={browse} aria-label='Browse'>
                    <FolderOpen size={16} />
                </IconButton>
            </div>
        </label>
    );
};

const DevModeModal = ({ open, onClose, onApply }: DevModeModalProps) => {
    const [enabled, setEnabled] = useState(false);
    const [voltPath, setVoltPath] = useState('');
    const [clusterDaemonPath, setClusterDaemonPath] = useState('');

    useEffect(() => {
        if(!open) return;
        window.volt.config.get().then((config) => {
            const dev = config.devMode ?? {};
            setEnabled(Boolean(dev.enabled));
            setVoltPath(dev.voltPath ?? '');
            setClusterDaemonPath(dev.clusterDaemonPath ?? '');
        });
    }, [open]);

    useEffect(() => {
        if(!open) return;
        const onKey = (event: KeyboardEvent) => { if(event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if(!open) return null;

    const pathsMissing = !voltPath.trim() || !clusterDaemonPath.trim();
    const blockApply = enabled && pathsMissing;

    const apply = () => {
        if(blockApply) return;
        onApply({ enabled, voltPath: voltPath.trim(), clusterDaemonPath: clusterDaemonPath.trim() });
    };

    return (
        <div className='dm-overlay' onMouseDown={onClose}>
            <div className='dm-modal' role='dialog' aria-modal='true' onMouseDown={(event) => event.stopPropagation()}>
                <header className='dm-header'>
                    <div>
                        <Heading level={2} size='lg' weight='semibold'>Developer Mode</Heading>
                        <Text as='p' size='xs' tone='secondary' className='dm-subtitle'>Deploy Volt from local source checkouts instead of published releases.</Text>
                    </div>
                    <CloseButton onClick={onClose} aria-label='Close' />
                </header>

                <div className='dm-toggle'>
                    <span>
                        <span className='dm-toggle-label'>Use local sources</span>
                        <span className='dm-toggle-hint'>When off, VOLT deploys the latest GitHub releases.</span>
                    </span>
                    <LiquidToggle pressed={enabled} onChange={setEnabled} aria-label='Use local sources' />
                </div>

                <fieldset className='dm-paths' disabled={!enabled}>
                    <PathField
                        label='VOLT'
                        hint='/path/to/volt'
                        value={voltPath}
                        onChange={setVoltPath}
                    />
                    <PathField
                        label='ClusterDaemon'
                        hint='/path/to/clusterdaemon'
                        value={clusterDaemonPath}
                        onChange={setClusterDaemonPath}
                    />
                </fieldset>

                <footer className='dm-footer'>
                    <Button variant='outline' onClick={onClose}>Cancel</Button>
                    <Button intent='brand' onClick={apply} disabled={blockApply}>Apply &amp; Redeploy</Button>
                </footer>
            </div>
        </div>
    );
};

export default DevModeModal;
