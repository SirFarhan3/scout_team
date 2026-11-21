'use client';

import React, { useState } from 'react';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} !pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        title={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-indigo-600 transition focus:outline-none"
      >
        {visible ? (
          <EyeInvisibleOutlined className="text-sm" />
        ) : (
          <EyeOutlined className="text-sm" />
        )}
      </button>
    </div>
  );
}
