import React from 'react';
import { createPortal } from 'react-dom';
import { IoCloseOutline } from 'react-icons/io5';
import { MdError, MdCheckCircle, MdWarning, MdInfo } from 'react-icons/md';
import useToastStore from '@/stores/ui/toast';
import type { Toast, ToastType } from '@/stores/ui/toast';
import './ToastContainer.css';
import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';

const getIcon = (type: ToastType) => {
  switch (type) {
    case 'error':
      return <MdError className='toast-icon' />;
    case 'success':
      return <MdCheckCircle className='toast-icon' />;
    case 'warning':
      return <MdWarning className='toast-icon' />;
    case 'info':
      return <MdInfo className='toast-icon' />;
    default:
      return null;
  }
};

const Toast: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className={`toast toast - ${toast.type} `}>
      <div className='toast-content'>
        {getIcon(toast.type)}
        <Paragraph className='toast-message'>{toast.message}</Paragraph>
      </div>
      <button
        className='toast-close-btn'
        onClick={() => removeToast(toast.id)}
        aria-label='Close notification'
      >
        <IoCloseOutline />
      </button>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const rootElement = document.getElementById('root');

  if (!rootElement || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <Container className='p-fixed d-flex column gap-075 toast-container'>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </Container>,
    rootElement
  );
};

export default ToastContainer;
