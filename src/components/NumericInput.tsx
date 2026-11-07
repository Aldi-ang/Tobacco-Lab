import React, { useState, useEffect } from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  allowDecimals = true,
  className = '',
  onFocus,
  onBlur,
  ...rest
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() =>
    value === 0 ? '0' : String(value ?? '')
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Sync from parent when not actively editing a transient state like "12." or ""
    if (!isFocused) {
      setDisplayValue(value === 0 ? '0' : String(value ?? 0));
    } else {
      const parsedCurrent = parseFloat(displayValue);
      if (!isNaN(parsedCurrent) && parsedCurrent !== value) {
        setDisplayValue(String(value));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Allow empty input while typing so user can clear the field freely
    if (raw === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Replace comma with dot for Indonesian decimal typing convenience
    raw = raw.replace(/,/g, '.');

    // Validate allowed characters
    const regex = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
    if (!regex.test(raw)) {
      return;
    }

    // Automatically strip leading zero when typing a number (e.g. "038" -> "38", "05" -> "5")
    // while preserving "0." for decimals
    if (/^0\d+/.test(raw)) {
      raw = raw.replace(/^0+/, '');
      if (raw === '') raw = '0';
    }

    setDisplayValue(raw);

    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      onChange(0);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all text on focus so typing immediately overwrites 0 or current number
    e.target.select();
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (displayValue === '' || displayValue === '.' || isNaN(parseFloat(displayValue))) {
      setDisplayValue('0');
      onChange(0);
    } else {
      const normalized = parseFloat(displayValue);
      setDisplayValue(String(normalized));
      onChange(normalized);
    }
    if (onBlur) onBlur(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};
