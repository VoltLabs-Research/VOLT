import React from 'react';
import { RiCloseLargeFill } from 'react-icons/ri';
import useUIStore from '@/stores/ui';
import './ShortcutsModal.css';

const ShortcutsModal = () => {
    const toggleShortcutsModal = useUIStore((state) => state.toggleShortcutsModal);
    const showShortcutsModal = useUIStore((state) => state.showShortcutsModal);

    return showShortcutsModal && (
        <div className='shortcuts-modal-wrapper'>
            <div className='shortcuts-modal-container'>
                <div className='shortcuts-modal-header-container'>
                    <h3 className='shortcuts-modal-header-title'>Keyboard Shortcuts</h3>
                    <i className='shortcuts-modal-header-close-icon-container' onClick={toggleShortcutsModal}>
                        <RiCloseLargeFill />
                    </i>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsModal;