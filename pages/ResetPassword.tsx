import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      console.error('Error updating password:', err.message);
      setError('Erro ao atualizar senha: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-4 font-display">
      {/* Background Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/95 z-10"></div>
        <div
          className="w-full h-full bg-cover bg-center opacity-10"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAvo8S0r-YmYyrDcmVhpeWv-67gh6kfZxmhNXne7EEuwZmngqYxevQXQnDpr3Fkh7KzNTP7BRQMhZmXpGffa32ydT0EnQSmalMjI-dnNiFd0RlnyIhvnd9oBu8mAoPbcC-4UBOn2bSB_pHev5kHtDq8bCz4rbJsiXyTp0tpqgzWcr2Pee5iwJl6hDTGDPT-zM9aUq05LkADQmZDSrVxseN9a5AVbVAQUX8SaXN5Q5PbhifIH9v_e2oHdOMOCPBelABqq3cOAZ0ffg')",
          }}
        ></div>
      </div>

      <div className="relative z-20 w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <div className="flex items-center gap-3 mb-8">
            <img src="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/cgna-logo.png" alt="CGNA" className="size-10 object-contain shadow-sm" />
            <div>
                <h2 className="text-xl font-bold leading-tight text-slate-900">Nova Senha</h2>
                <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Redefinição de Acesso</p>
            </div>
        </div>

        {success ? (
          <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
            <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <span className="material-symbols-outlined text-5xl">check_circle</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Senha Atualizada!</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">Sua senha foi alterada com sucesso. Você será redirecionado para a tela de login em alguns instantes.</p>
            <button 
              onClick={() => navigate('/')} 
              className="w-full py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95"
            >
              Ir para Login agora
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-blue-800 text-sm flex gap-3">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <p>Digite sua nova senha abaixo para recuperar o acesso ao seu perfil no sistema.</p>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">Nova Senha</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all shadow-sm"
                    placeholder="Mínimo 6 caracteres"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">Confirmar Senha</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock_reset</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all shadow-sm"
                    placeholder="Repita a nova senha"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-xs font-bold animate-in shake duration-300 flex gap-3 items-center">
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </div>
              ) : (
                <>
                  <span>Definir Nova Senha</span>
                  <span className="material-symbols-outlined">star</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm"
            >
              Voltar para o Login
            </button>
          </form>
        )}
      </div>

      <p className="relative z-20 mt-8 text-slate-400 text-xs font-medium">
        <i>Desenvolvido por 1S Robson</i>
      </p>
    </div>
  );
};

export default ResetPassword;
