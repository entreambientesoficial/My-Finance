import React, { ForwardRefRenderFunction, forwardRef } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  currency?: 'BRL' | 'USD';
}

const CurrencyInputBase: ForwardRefRenderFunction<HTMLInputElement, CurrencyInputProps> = (
  { value, onChange, currency = 'BRL', className, ...props },
  ref
) => {
  const formatValue = (val: number) => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
    return currency === 'USD' ? `US$ ${formatted}` : `R$ ${formatted}`;
  };

  const displayValue = formatValue(value || 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) { onChange(0); return; }
    const parsed = parseInt(digits, 10);
    onChange(parsed / 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && (value === 0 || !value)) e.preventDefault();
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    target.setSelectionRange(target.value.length, target.value.length);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    setTimeout(() => target.setSelectionRange(target.value.length, target.value.length), 0);
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
