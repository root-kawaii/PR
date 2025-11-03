import { useState } from 'react';

export const useModal = () => {
  const [isVisible, setIsVisible] = useState(false);

  const open = () => setIsVisible(true);
  const close = () => setIsVisible(false);
  const toggle = () => setIsVisible(prev => !prev);

  return { isVisible, open, close, toggle };
};