import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface AdminLoginViewProps {
  onLoginSuccess: (token: string) => void;
  onNavigate: (route: string) => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        // Generic error message that doesn't leak whether username exists
        setError(data.error || 'Kredensial login tidak sah. Akses ditolak.');
      } else {
        onLoginSuccess(data.token);
      }
    } catch {
      setError('Terjadi kendala autentikasi server. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#24221F] flex flex-col justify-center items-center p-4 antialiased">
      {/* Centered Panel (400px max width, ivory canvas, 20px radius, soft shadow) */}
      <div className="w-full max-w-[400px] bg-white border border-[#E9E5DF] rounded-[20px] p-7 sm:p-8 shadow-[0_6px_24px_rgba(36,34,31,.05)] text-left">

        {/* Real Brand Logo + Heading */}
        <div className="text-center mb-6">
          <div className="w-12 h-10 mx-auto mb-3 flex items-center justify-center">
            <img
              src="/public/assets/brand/defra-logo.svg"
              alt="Defra Hijab Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#24221F]">
            Masuk ke Defra Owner
          </h1>
          <p className="text-xs text-[#716B64] mt-1">
            Panel resmi pengelola toko &amp; laporan finansial
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-[#FAECEA] border border-[#B33D39]/30 rounded-[12px] flex items-start gap-2.5 text-xs text-[#B33D39] animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#24221F] font-medium mb-1.5">
              Email Owner
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@domain.com"
              className="w-full h-11 px-3.5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] text-base md:text-sm text-[#24221F] outline-none focus:border-[#87533F] focus:bg-white transition-all placeholder:text-[#716B64]/50"
            />
          </div>

          <div>
            <label className="block text-[#24221F] font-medium mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 pl-3.5 pr-10 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] text-base md:text-sm text-[#24221F] outline-none focus:border-[#87533F] focus:bg-white transition-all placeholder:text-[#716B64]/50 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#716B64] hover:text-[#24221F] transition-colors"
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-[#24221F] hover:bg-[#40322B] text-white font-semibold rounded-[10px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            {loading ? (
              <span>Memverifikasi Akses...</span>
            ) : (
              <span>Masuk ke Dashboard</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E9E5DF] text-center">
          <p className="text-[11px] text-[#716B64]">
            Koneksi terenkripsi · Pembatasan percobaan login aktif
          </p>
        </div>

      </div>
    </div>
  );
};
