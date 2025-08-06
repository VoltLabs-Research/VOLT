import React from 'react';
import Loader from '@/components/atoms/Loader';
import { useNavigate } from 'react-router';
import './Button.css';

const Button = ({ title, isLoading = false, className = '', to = null, onClick = () => {}, ...props }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        onClick();

        if(to){
            navigate(to);
        }
    };

    return (
        <button
            {...props}
            className={'button '.concat(className)}
            onClick={handleClick}
        >
            {isLoading ? (
                <div className='button-loader-layer-container'>
                    <Loader scale={0.6} />
                </div>
            ) : (
                <span className='button-text'>{title}</span>
            )}
        </button>
    );
};

export default Button;