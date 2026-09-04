import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button, Input, Label, Modal, Switch, TextField } from '@heroui/react';
import type { DevModeState } from '@/services/AppConfig';

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
        <TextField className='flex w-full flex-col' value={value} onChange={onChange} fullWidth>
            <Label className='mb-1.5 block text-xs font-medium text-muted'>{label}</Label>
            <div className='flex items-center gap-2'>
                <Input className='flex-1' spellCheck={false} placeholder={hint} />
                <Button isIconOnly variant='ghost' size='md' onPress={browse} aria-label='Browse'>
                    <FolderOpen size={16} />
                </Button>
            </div>
        </TextField>
    );
};

const DevModeModal = ({ open, onClose, onApply }: DevModeModalProps) => {
    const [enabled, setEnabled] = useState(false);
    const [voltPath, setVoltPath] = useState('');

    useEffect(() => {
        if(!open) return;
        window.volt.config.get().then((config) => {
            const dev = (config.devMode ?? {}) as Partial<DevModeState>;
            setEnabled(Boolean(dev.enabled));
            setVoltPath(dev.voltPath ?? '');
        });
    }, [open]);

    const pathsMissing = !voltPath.trim();
    const blockApply = enabled && pathsMissing;

    const apply = () => {
        if(blockApply) return;
        onApply({
            enabled,
            voltPath: voltPath.trim()
        });
    };

    return (
        <Modal isOpen={open} onOpenChange={(isOpen) => { if(!isOpen) onClose(); }}>
            <Modal.Backdrop variant='blur' className='no-drag-region backdrop-blur-[4px]'>
                <Modal.Container placement='center' size='md'>
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header className='gap-1 pr-8'>
                            <Modal.Heading className='text-base font-[550] text-foreground'>Developer Mode</Modal.Heading>
                            <p className='text-xs text-muted'>Run the stack from a VOLT checkout instead of the bundled runtime. Build it first with npm run stack:build in its desktop/ folder.</p>
                        </Modal.Header>
                        <Modal.Body className='flex flex-col gap-4'>
                            <div className='flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-secondary px-3.5 py-3'>
                                <span>
                                    <span className='block text-[13px] font-medium text-foreground'>Use local sources</span>
                                    <span className='mt-0.5 block text-[11.5px] text-muted/75'>When off, VOLT deploys the latest GitHub releases.</span>
                                </span>
                                <Switch className='shrink-0' isSelected={enabled} onChange={setEnabled} aria-label='Use local sources'>
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Content>
                                </Switch>
                            </div>
                            <fieldset className='m-0 flex flex-col gap-3.5 border-0 p-0 transition-opacity duration-[160ms] ease-out-fluid disabled:opacity-45' disabled={!enabled}>
                                <PathField
                                    label='VOLT'
                                    hint='/path/to/volt'
                                    value={voltPath}
                                    onChange={setVoltPath}
                                />
                            </fieldset>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant='outline' onPress={onClose}>Cancel</Button>
                            <Button variant='primary' onPress={apply} isDisabled={blockApply}>Apply &amp; Redeploy</Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};

export default DevModeModal;
