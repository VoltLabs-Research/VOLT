import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoTrash } from 'react-icons/io5';
import containerApi from '@/services/api/container';
import useToast from '@/hooks/ui/use-toast';
import './EditContainerModal.css';
import Title from '@/components/primitives/Title';

interface EditContainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    container: any;
    onSuccess: () => void;
}

const EditContainerModal: React.FC<EditContainerModalProps> = ({ isOpen, onClose, container, onSuccess }) => {
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

    if (!isOpen) return null;

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
            onClose();
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to update container');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <Title className='font-size-2'>Edit Container: {container.name}</Title>
                    <button onClick={onClose} className="close-btn"><IoClose size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-section">
                        <div className="section-header">
                            <label>Environment Variables</label>
                            <button type="button" onClick={handleAddEnv} className="add-btn"><IoAdd /> Add</button>
                        </div>
                        {env.map((e, i) => (
                            <div key={i} className="row-inputs">
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
                                <button type="button" onClick={() => handleRemoveEnv(i)} className="remove-btn"><IoTrash /></button>
                            </div>
                        ))}
                    </div>

                    <div className="form-section">
                        <div className="section-header">
                            <label>Port Bindings</label>
                            <button type="button" onClick={handleAddPort} className="add-btn"><IoAdd /> Add</button>
                        </div>
                        {ports.map((p, i) => (
                            <div key={i} className="row-inputs">
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
                                <button type="button" onClick={() => handleRemovePort(i)} className="remove-btn"><IoTrash /></button>
                            </div>
                        ))}
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
                        <button type="submit" disabled={loading} className="submit-btn">
                            {loading ? 'Updating...' : 'Save Changes(Recreate)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditContainerModal;
