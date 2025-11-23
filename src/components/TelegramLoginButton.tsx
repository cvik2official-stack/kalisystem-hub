
import React, { useEffect, useRef } from 'react';
import { TelegramUser } from '../types';

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: boolean;
  usePic?: boolean;
}

const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({ 
    botName, 
    onAuth, 
    buttonSize = 'large', 
    cornerRadius = 12, 
    requestAccess = true, 
    usePic = true 
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    
    // Clean up any existing scripts to prevent duplicates on re-renders
    wrapperRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    if (cornerRadius !== undefined) script.setAttribute('data-radius', cornerRadius.toString());
    if (requestAccess) script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', usePic.toString());
    
    // Define the global callback function that Telegram's widget will call
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };
    
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    wrapperRef.current.appendChild(script);
    
    // Cleanup global function on unmount
    return () => {
        delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth, buttonSize, cornerRadius, requestAccess, usePic]);

  return <div ref={wrapperRef} className="flex justify-center mt-4" />;
};

export default TelegramLoginButton;
