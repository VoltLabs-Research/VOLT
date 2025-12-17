import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoTrash } from 'react-icons/io5';
import containerApi from '@/services/api/container';
import useToast from '@/hooks/ui/use-toast';
import './EditContainerModal.css';
import Title from '@/components/primitives/Title';
import Button from '@/components/primitives/Button';
import Modal from '@/components/molecules/common/Modal';

interface EditContainerModalProps {
    container: any;
    onSuccess: () => void;
}

const EditContainerModal: React.FC<EditContainerModalProps> = ({ container, onSuccess }) => {
    const [env, setEnv] = useState<{ key: string; value: string }[]>([]);
    const [ports, setPorts] = useState<{ private: number; public: number }[]>([]);
    const [memory, setMemory] = useState<number>(512);
    const [cpus, setCpus] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const { showSuccess, showError } = useToast();

    useEffect(() => {
        if (container) {
            setEnv(container.env || []);
            setPorts(container.ports || []);
            setMemory(container.memory || 512);
            setCpus(container.cpus || 1);
        }
    }, [container]);

    if (!container) return null;

    const handleAddEnv = () => setEnv([...env, { key: '', value: '' }]);
    const handleRemoveEnv = (index: number) => setEnv(env.filter((_, i) => i !== index));
    const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
        const newEnv = [...env];
        newEnv[index][field] = value;
        setEnv(newEnv);
    };

    const handleAddPort = () => setPorts([...ports, { private: 0, public: 0 }]);
    const handleRemovePort = (index: number) => setPorts(ports.filter((_, i) => i !== index));
    const handlePortChange = (index: number, field: 'private' | 'public', value: string) => {
        const newPorts = [...ports];
        newPorts[index][field] = parseInt(value) || 0;
        setPorts(newPorts);
    };

    const closeModal = () => {
        (document.getElementById('edit-container-modal') as HTMLDialogElement)?.close();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await containerApi.update(container._id, {
                environment: Object.fromEntries(env.filter(e => e.key).map(e => [e.key, e.value])),
                ports: Object.fromEntries(ports.map(p => [p.private.toString(), p.public])),
                memory,
                cpus
            });
            showSuccess('Container updated successfully');
            onSuccess();
            closeModal();
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to update container');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            id='edit-container-modal'
            title={`Edit Container: ${container.name}`}
            width='600px'
            className='edit-container-modal'
        >
            <form onSubmit={handleSubmit} className="d-flex column modal-form gap-1-5 y-auto">
                <div className="d-flex column form-section p-relative gap-1 vh-max">
                    <div className="section-header d-flex items-center content-between">
                        <label>Environment Variables</label>
                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoAdd />} onClick={handleAddEnv}>Add</Button>
                    </div>
                    {env.map((e, i) => (
                        <div key={i} className="d-flex items-center gap-075 row-inputs">
                            <input
                                placeholder="Key"
                                value={e.key}
                                onChange={(ev) => handleEnvChange(i, 'key', ev.target.value)}
                            />
                            <input
                                placeholder="Value"
                                value={e.value}
                                onChange={(ev) => handleEnvChange(i, 'value', ev.target.value)}
                            />
                            <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => handleRemoveEnv(i)}><IoTrash /></Button>
                        </div>
                    ))}
                </div>

                <div className="d-flex column form-section p-relative gap-1 vh-max">
                    <div className="section-header d-flex items-center content-between">
                        <label>Port Bindings</label>
                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoAdd />} onClick={handleAddPort}>Add</Button>
                    </div>
                    {ports.map((p, i) => (
                        <div key={i} className="d-flex items-center gap-075 row-inputs">
                            <input
                                type="number"
                                placeholder="Container Port"
                                value={p.private}
                                onChange={(ev) => handlePortChange(i, 'private', ev.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="Host Port"
                                value={p.public}
                                onChange={(ev) => handlePortChange(i, 'public', ev.target.value)}
                            />
                            <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => handleRemovePort(i)}><IoTrash /></Button>
                        </div>
                    ))}
                </div>

                <div className="d-flex content-end gap-1 modal-actions">
                    <Button
                        variant='ghost'
                        intent='neutral'
                        commandfor="edit-container-modal"
                        command="close"
                    >
                        Cancel
                    </Button>
                    <Button variant='solid' intent='brand' type="submit" disabled={loading} isLoading={loading}>
                        Save Changes (Recreate)
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default EditContainerModal;
