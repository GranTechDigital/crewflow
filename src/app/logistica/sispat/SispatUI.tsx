'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Button } from 'flowbite-react';
import styles from './sispat.module.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };
export const ActionButton = forwardRef<HTMLButtonElement, Props>(function ActionButton({ variant = 'secondary', type = 'button', ...props }, ref) {
  return <Button {...props} ref={ref} type={type} size="sm" color={variant} theme={{
    base: styles.uiButton, size: { sm: styles.uiButtonSize }, disabled: styles.uiDisabled,
    color: { primary: styles.uiPrimary, secondary: styles.uiSecondary, ghost: styles.uiGhost, danger: styles.uiDanger },
  }} applyTheme={{ base: 'replace', disabled: 'replace', size: { sm: 'replace' }, color: { primary: 'replace', secondary: 'replace', ghost: 'replace', danger: 'replace' } }} />;
});
