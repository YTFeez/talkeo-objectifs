import { useState } from 'react';

export default function PasswordInput({ id, value, onChange, className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-field ${className}`.trim()}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        {...props}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le code' : 'Afficher le code'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? 'Masquer' : 'Voir'}
      </button>
    </div>
  );
}
