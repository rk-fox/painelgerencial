import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface User {
  id: string;
  name: string;
  war_name: string;
  rank: string;
  abrev: string;
  specialty: string;
  avatar: string;
  requires_password: boolean;
  password_hash: string | null;
}

const rankOrder: Record<string, number> = {
  'Major': 1, 'MAJ': 1,
  'Capitão': 2, 'CAP': 2,
  '1º Tenente': 3, '1TEN': 3,
  '2º Tenente': 4, '2TEN': 4,
  'Suboficial': 5, 'SO': 5,
  '1º Sargento': 6, '1SGT': 6,
  '2º Sargento': 7, '2SGT': 7,
  '3º Sargento': 8, '3SGT': 8,
  'Civil': 9, 'CIV': 9,
};

// Fallback abbreviations for legacy data
const legacyAbbr: Record<string, string> = {
  'MAJ': 'Maj.', 'CAP': 'Cap.', '1TEN': 'Ten.', '2TEN': 'Ten.',
  'SO': 'SO.', '1SGT': 'Sgt.', '2SGT': 'Sgt.', '3SGT': 'Sgt.', 'CIV': 'Cv.'
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [dontUsePassword, setDontUsePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*');

      if (error) throw error;

      const sortedUsers = (data || []).sort((a, b) => {
        const orderA = rankOrder[a.rank] || 99;
        const orderB = rankOrder[b.rank] || 99;
        return orderA - orderB;
      });

      setUsers(sortedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
      setError('Erro ao carregar perfis');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayName = (user: User) => {
    const abbr = user.abrev || legacyAbbr[user.rank] || '';
    const name = user.war_name || user.name.split(' ')[0];
    return abbr ? `${abbr} ${name}` : name;
  };

  const handleUserClick = (user: User) => {
    if (user.requires_password || user.password_hash === null) {
      setSelectedUser(user);
      setPassword('');
      setDontUsePassword(false);
    } else {
      // No password required, save session and go directly to dashboard
      localStorage.setItem('currentUser', JSON.stringify(user));
      navigate('/app/dashboard');
    }
  };

  const handleLogin = async () => {
    if (!selectedUser) return;

    try {
      if (selectedUser.password_hash === null) {
        // First access registration
        if (!dontUsePassword && !password) {
          setError('Defina uma senha ou marque a opção sem senha');
          return;
        }

        const { error } = await supabase
          .from('members')
          .update({
            password_hash: dontUsePassword ? 'DISABLED' : password,
            requires_password: !dontUsePassword
          })
          .eq('id', selectedUser.id);

        if (error) throw error;

        // Save session after successful registration
        localStorage.setItem('currentUser', JSON.stringify({
          ...selectedUser,
          requires_password: !dontUsePassword,
          password_hash: dontUsePassword ? 'DISABLED' : password
        }));

        navigate('/app/dashboard');
      } else {
        // Regular login
        if (selectedUser.requires_password) {
          if (password === selectedUser.password_hash) {
            localStorage.setItem('currentUser', JSON.stringify(selectedUser));
            navigate('/app/dashboard');
          } else {
            setError('Senha incorreta');
          }
        } else {
          localStorage.setItem('currentUser', JSON.stringify(selectedUser));
          navigate('/app/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err.message);
      setError('Erro ao realizar login');
    }
  };

  const handleCancel = () => {
    setSelectedUser(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getFormalRank = (user: User) => {
    const formalRanks: Record<string, string> = {
      'MAJ': 'Major', 'CAP': 'Capitão', '1TEN': '1º Tenente', '2TEN': '2º Tenente',
      'SO': 'Suboficial', '1SGT': '1º Sargento', '2SGT': '2º Sargento', '3SGT': '3º Sargento', 'CIV': 'Civil'
    };
    return formalRanks[user.rank] || user.rank;
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col bg-[#f8fafc] font-display">
      {/* Background Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/95 z-10"></div>
        <div className="w-full h-full bg-cover bg-center opacity-10" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAvo8S0r-YmYyrDcmVhpeWv-67gh6kfZxmhNXne7EEuwZmngqYxevQXQnDpr3Fkh7KzNTP7BRQMhZmXpGffa32ydT0EnQSmalMjI-dnNiFd0RlnyIhvnd9oBu8mAoPbcC-4UBOn2bSB_pHev5kHtDq8bCz4rbJsiXyTp0tpqgzWcr2Pee5iwJl6hDTGDPT-zM9aUq05LkADQmZDSrVxseN9a5AVbVAQUX8SaXN5Q5PbhifIH9v_e2oHdOMOCPBelABqq3cOAZ0ffg')" }}></div>
      </div>

      <div className="relative z-20 flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-10 py-6">
          <div className="flex items-center gap-3 text-[#0f172a]">
            <img
              src="/cgna-logo.png"
              alt="CGNA"
              className="size-8 shadow-lg object-contain"
            />
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight">CGNA</h2>
              <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Painel Gerencial</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors active:scale-95">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-6xl mx-auto w-full">
          <div className="mb-12 text-center">
            <h1 className="text-[#0f172a] text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Quem está acessando?</h1>
            <p className="text-[#64748b] text-lg">Selecione seu perfil para entrar no sistema de gerenciamento.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-3xl">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-4">
                <button
                  onClick={() => handleUserClick(user)}
                  className={`bg-white border shadow-sm flex flex-col items-center p-6 rounded-xl group relative transition-all active:scale-95 ${selectedUser?.id === user.id
                    ? 'border-2 border-primary ring-4 ring-primary/10 shadow-lg'
                    : 'border-slate-200 hover:shadow-lg hover:-translate-y-1'
                    }`}
                >
                  <div className={`absolute top-3 right-3 transition-colors ${selectedUser?.id === user.id ? 'text-primary' : 'text-slate-300'
                    }`}>
                    <span className="material-symbols-outlined text-sm">
                      {(user.requires_password || user.password_hash === null) ? 'lock' : 'door_open'}
                    </span>
                  </div>
                  <div className={`w-24 h-24 mb-4 rounded-full border-2 p-1 transition-colors ${selectedUser?.id === user.id ? 'border-primary' : 'border-slate-100'
                    }`}>
                    <div className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full" style={{ backgroundImage: `url("${user.avatar}")` }}></div>
                  </div>
                  <div className="text-center">
                    <p className="text-[#0f172a] text-lg font-bold">{formatDisplayName(user)}</p>
                    <p className={`text-xs font-bold uppercase tracking-widest ${selectedUser?.id === user.id ? 'text-primary' : 'text-[#64748b]'
                      }`}>{getFormalRank(user)} ({user.specialty})</p>
                  </div>
                </button>

                {/* Password input - only shows for selected user that requires password or hasn't set one */}
                {selectedUser?.id === user.id && (user.requires_password || user.password_hash === null) && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      {user.password_hash === null ? 'Cadastre sua senha de acesso' : 'Digite sua senha'}
                    </div>
                    <div className="relative">
                      <input
                        className="w-full bg-white border border-slate-200 rounded-lg py-3 px-4 text-[#0f172a] placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
                        placeholder={dontUsePassword ? 'Acesso livre ativado' : 'Sua senha'}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={dontUsePassword}
                        autoFocus
                      />
                      {!dontUsePassword && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0f172a] transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      )}
                    </div>

                    {user.password_hash === null && (
                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          id="no-password"
                          checked={dontUsePassword}
                          onChange={(e) => setDontUsePassword(e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="no-password" className="text-sm text-slate-600 cursor-pointer">
                          Não utilizar senha
                        </label>
                      </div>
                    )}

                    {error && <p className="text-red-500 text-xs px-1">{error}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-lg transition-all active:scale-95 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleLogin}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 active:scale-95 text-sm"
                      >
                        <span>{user.password_hash === null ? 'Confirmar' : 'Acessar'}</span>
                        <span className="material-symbols-outlined text-sm">login</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        <footer className="mt-auto px-10 py-8 flex flex-col md:flex-row items-center justify-between text-[#64748b] text-sm border-t border-slate-200 bg-white">
          <div className="flex gap-8 mb-4 md:mb-0">
            <a className="hover:text-primary transition-colors flex items-center gap-2" href="#">
              <span className="material-symbols-outlined text-lg">vpn_key</span>
              Esqueci minha senha
            </a>
            <a className="hover:text-primary transition-colors flex items-center gap-2" href="#">
              <span className="material-symbols-outlined text-lg">security</span>
              Política de Acesso
            </a>
          </div>
          <p>© 2024 Gestão BCT/AIS. Controle e Segurança.</p>
        </footer>
      </div>
    </div>
  );
};

export default Login;