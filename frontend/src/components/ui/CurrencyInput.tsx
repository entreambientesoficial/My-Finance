import React, { ForwardRefRenderFunction, forwardRef } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

const CurrencyInputBase: ForwardRefRenderFunction<HTMLInputElement, CurrencyInputProps> = (
  { value, onChange, className, ...props },
  ref
) => {
  // Format numeric value to BRL string: e.g. 12.34 -> "R$ 12,34"
  const formatBRL = (val: number) => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
    return `R$ ${formatted}`;
  };

  const displayValue = formatBRL(value || 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Extract only digits
    const digits = rawValue.replace(/\D/g, '');
    
    if (!digits) {
      onChange(0);
      return;
    }
    
    const parsed = parseInt(digits, 10);
    const numericValue = parsed / 100;
    onChange(numericValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If user presses backspace when value is already 0, do nothing
    if (e.key === 'Backspace' && (value === 0 || !value)) {
      e.preventDefault();
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const len = target.value.length;
    // Always keep cursor at the end to support right-to-left typing
    target.setSelectionRange(len, len);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    // Delay selection range setting slightly to ensure focus completes first
    setTimeout(() => {
      const len = target.value.length;
      target.setSelectionRange(len, len);
    }, 0);
  };

  return (
    <input
      type="text"
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSelect={handleSelect}
      onFocus={handleFocus}
      className={className}
      {...props}
    />
  );
};

export const CurrencyInput = forwardRef(CurrencyInputBase);
