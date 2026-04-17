import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

interface User {
  id: string;
  name: string;
  email: string;
  war_name: string;
  rank: string;
  abrev: string;
  specialty: string;
  avatar: string;
  sector?: string;
  last_promotion_date?: string;
  guia_antiguidade?: number;
}

// Rank Priority Logic
const getRankPriority = (
  rankStr: string | null,
  abrevStr: string | null,
): number => {
  const s = (rankStr || abrevStr || "").toUpperCase().trim();
  if (s.includes("MAJOR") || s.includes("MAJ")) return 0;
  if (s.includes("CAPIT")) return 1;
  if (s.includes("1º TEN") || s.includes("1.º TEN") || s.includes("1TEN")) {
    return 2;
  }
  if (
    s.includes("2º TEN") || s.includes("2.º TEN") || s.includes("2TEN") ||
    s.includes("ASP")
  ) return 3;
  if (s.includes("SUBOF") || s.includes("SO.")) return 4;
  if (s.includes("1º SAR") || s.includes("1.º SAR") || s.includes("1SGT")) {
    return 5;
  }
  if (s.includes("2º SAR") || s.includes("2.º SAR") || s.includes("2SGT")) {
    return 6;
  }
  if (s.includes("3º SAR") || s.includes("3.º SAR") || s.includes("3SGT")) {
    return 7;
  }
  if (s.includes("SGT")) return 7;
  if (s.includes("CIV")) return 8;
  return 99;
};

// Fallback abbreviations for legacy data
const legacyAbbr: Record<string, string> = {
  "MAJ": "Maj.",
  "CAP": "Cap.",
  "1TEN": "Ten.",
  "2TEN": "Ten.",
  "SO": "SO.",
  "1SGT": "Sgt.",
  "2SGT": "Sgt.",
  "3SGT": "Sgt.",
  "CIV": "Cv.",
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [password, setPassword] = useState("");
  const [dontUsePassword, setDontUsePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    checkSession();
    fetchUsers();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const userJson = localStorage.getItem('currentUser');
      const sector = userJson ? JSON.parse(userJson).sector : null;
      navigate(sector === 'CH' ? '/app/tasks/new' : '/app/dashboard');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("members")
        .select("*");

      if (error) throw error;

      const sortedUsers = (data || []).sort((a, b) => {
        const pA = getRankPriority(a.rank, a.abrev);
        const pB = getRankPriority(b.rank, b.abrev);
        if (pA !== pB) return pA - pB;

        // Sort by last promotion date (oldest to newest)
        const dateA = a.last_promotion_date ? new Date(a.last_promotion_date).getTime() : Infinity;
        const dateB = b.last_promotion_date ? new Date(b.last_promotion_date).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;

        // Tie-breaker: guia_antiguidade
        const guiaA = a.guia_antiguidade ?? 9999;
        const guiaB = b.guia_antiguidade ?? 9999;
        return guiaA - guiaB;
      });
      setUsers(sortedUsers);
    } catch (err: any) {
      console.error("Error fetching users:", err.message);
      setError("Erro ao carregar perfis");
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayName = (user: User) => {
    const abbr = user.abrev || legacyAbbr[user.rank] || "";
    const name = user.war_name || user.name.split(" ")[0];
    return abbr ? `${abbr} ${name}` : name;
  };

  const handleUserClick = async (user: User) => {
    setSelectedUser(user);
    setPassword("");
  };

  const handleLogin = async () => {
    if (!selectedUser || !password) return;

    try {
      setLoading(true);
      setError(null);

      // Attempt to sign in with Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth
        .signInWithPassword({
          email: selectedUser.email,
          password: password,
        });

      if (signInError) {
        // If the user doesn't have an auth entry yet (first access)
        // Note: In some Supabase configs, missing user returns 400 with "Invalid login credentials"
        // Since we want "choose on next access", we check if the user has a user_id linked.

        const { data: memberData } = await supabase
          .from("members")
          .select("user_id")
          .eq("email", selectedUser.email)
          .single();

        if (memberData && !memberData.user_id) {
          // Attempt sign up as the "First Access" registration
          const { data: signUpData, error: signUpError } = await supabase.auth
            .signUp({
              email: selectedUser.email,
              password: password,
            });

          if (signUpError) throw signUpError;

          if (signUpData.user) {
            // Check if email confirmation is required
            if (signUpData.session) {
              // Already logged in
              localStorage.setItem(
                "currentUser",
                JSON.stringify({
                  ...selectedUser,
                  user_id: signUpData.user.id,
                }),
              );
              const destination = selectedUser.sector === 'CH' ? '/app/tasks/new' : '/app/dashboard';
              navigate(destination);
            } else {
              setError("Verifique seu e-mail para confirmar a conta");
            }
          }
        } else {
          // User exists or is already registered but password was wrong
          setError("E-mail ou senha incorretos");
        }
      } else {
        // Success
        localStorage.setItem(
          "currentUser",
          JSON.stringify({ ...selectedUser, user_id: signInData.user.id }),
        );
        const destination = selectedUser.sector === 'CH' ? '/app/tasks/new' : '/app/dashboard';
        navigate(destination);
      }
    } catch (err: any) {
      console.error("Login error:", err.message);
      setError("Erro ao realizar login: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedUser(null);
    setError(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + window.location.pathname + '#/reset-password',
      });

      if (error) throw error;

      setResetSuccess(true);
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(false);
        setResetEmail("");
      }, 5000);
    } catch (err: any) {
      console.error("Reset error:", err.message);
      setError("Erro ao solicitar recuperação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openResetModal = () => {
    if (selectedUser) {
      setResetEmail(selectedUser.email);
    }
    setShowResetModal(true);
    setResetSuccess(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary">
        </div>
      </div>
    );
  }

  const getFormalRank = (user: User) => {
    const formalRanks: Record<string, string> = {
      "MAJ": "Major",
      "CAP": "Capitão",
      "1TEN": "1º Tenente",
      "2TEN": "2º Tenente",
      "SO": "Suboficial",
      "1SGT": "1º Sargento",
      "2SGT": "2º Sargento",
      "3SGT": "3º Sargento",
      "CIV": "Civil",
    };
    return formalRanks[user.rank] || user.rank;
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col bg-[#f8fafc] font-display">
      {/* Background Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/95 z-10">
        </div>
        <div
          className="w-full h-full bg-cover bg-center opacity-10"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAvo8S0r-YmYyrDcmVhpeWv-67gh6kfZxmhNXne7EEuwZmngqYxevQXQnDpr3Fkh7KzNTP7BRQMhZmXpGffa32ydT0EnQSmalMjI-dnNiFd0RlnyIhvnd9oBu8mAoPbcC-4UBOn2bSB_pHev5kHtDq8bCz4rbJsiXyTp0tpqgzWcr2Pee5iwJl6hDTGDPT-zM9aUq05LkADQmZDSrVxseN9a5AVbVAQUX8SaXN5Q5PbhifIH9v_e2oHdOMOCPBelABqq3cOAZ0ffg')",
          }}
        >
        </div>
      </div>

      <div className="relative z-20 flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-10 py-6">
          <div className="flex items-center gap-3 text-[#0f172a]">
            <img
              src="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/cgna-logo.png"
              alt="CGNA"
              className="size-8 shadow-lg object-contain"
            />
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight">
                CGNA
              </h2>
              <p className="text-[10px] text-primary font-bold tracking-widest uppercase">
                Painel Gerencial
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowHelpModal(true)}
              className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-6xl mx-auto w-full">
          <div className="mb-12 text-center">
            <h1 className="text-[#0f172a] text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Quem está acessando?
            </h1>
            <p className="text-[#64748b] text-lg">
              Selecione seu perfil para entrar no sistema de gerenciamento.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 w-full">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-4">
                <button
                  onClick={() =>
                    handleUserClick(user)}
                  className={`bg-white border shadow-sm flex flex-col items-center p-6 rounded-xl group relative transition-all active:scale-95 ${
                    selectedUser?.id === user.id
                      ? "border-2 border-primary ring-4 ring-primary/10 shadow-lg"
                      : "border-slate-200 hover:shadow-lg hover:-translate-y-1"
                  }`}
                >
                  <div
                    className={`absolute top-3 right-3 transition-colors ${
                      selectedUser?.id === user.id
                        ? "text-primary"
                        : "text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      lock
                    </span>
                  </div>
                  <div
                    className={`w-24 h-24 mb-4 rounded-full border-2 p-1 transition-colors ${
                      selectedUser?.id === user.id
                        ? "border-primary"
                        : "border-slate-100"
                    }`}
                  >
                    <div
                      className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full"
                      style={{ backgroundImage: `url("${user.avatar}")` }}
                    >
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[#0f172a] text-lg font-bold">
                      {formatDisplayName(user)}
                    </p>
                    <p
                      className={`text-xs font-bold uppercase tracking-widest ${
                        selectedUser?.id === user.id
                          ? "text-primary"
                          : "text-[#64748b]"
                      }`}
                    >
                      {getFormalRank(user)} ({user.specialty})
                    </p>
                  </div>
                </button>

                {/* Password input - always shows for selected user */}
                {selectedUser?.id === user.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLogin();
                    }}
                    className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300"
                  >
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      Digite sua senha para acessar
                    </div>
                    <div className="relative">
                      <input
                        className="w-full bg-white border border-slate-200 rounded-lg py-3 px-4 text-[#0f172a] placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
                        placeholder="Sua senha"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0f172a] transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>

                    {error && (
                      <p className="text-red-500 text-xs px-1">{error}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-lg transition-all active:scale-95 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 active:scale-95 text-sm"
                        disabled={loading}
                      >
                        <span>Acessar</span>
                        <span className="material-symbols-outlined text-sm">
                          login
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </main>

        <footer className="mt-auto px-10 py-8 flex flex-col md:flex-row items-center justify-between text-[#64748b] text-sm border-t border-slate-200 bg-white">
          <div className="flex gap-8 mb-4 md:mb-0">
            <button
              onClick={openResetModal}
              className="hover:text-primary transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">vpn_key</span>
              Esqueci minha senha
            </button>
            <a
              className="hover:text-primary transition-colors flex items-center gap-2"
              href="#"
            >
              <span className="material-symbols-outlined text-lg">
                security
              </span>
              Política de Acesso
            </a>
          </div>
          <p>
            <i>Desenvolvido por 1S Robson</i>
          </p>
        </footer>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">restart_alt</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Recuperar Senha</h3>
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Segurança Operacional</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowResetModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {resetSuccess ? (
                <div className="text-center py-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="size-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">E-mail Enviado!</h4>
                  <p className="text-slate-500 text-sm">
                    Enviamos as instruções de recuperação para <strong>{resetEmail}</strong>. Verifique sua caixa de entrada e spam.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Informe o e-mail cadastrado no seu perfil para receber um link de redefinição de senha.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:bg-white outline-none transition-all"
                        placeholder="seu@email.com.br"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-500 p-3 rounded-lg text-xs font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">error</span>
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] px-4 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span>Enviar Link</span>
                          <span className="material-symbols-outlined">send</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined">contact_support</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Solicitar Acesso</h3>
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Instruções de Cadastro</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-slate-600 leading-relaxed">
                  <p className="mb-4">
                    Para garantir a segurança dos dados operacionais do CGNA, o cadastro de novos usuários é restrito.
                  </p>
                  <p className="font-medium text-slate-900">
                    O seu cadastro no sistema deve ser solicitado a um administrador ou membro já cadastrado para sua inclusão.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-3 text-xs text-slate-500 italic">
                  <span className="material-symbols-outlined text-slate-400">info</span>
                  <p>Após a inclusão pelo administrador, seu perfil aparecerá automaticamente nesta tela na próxima vez que você acessá-la.</p>
                </div>

                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-full mt-4 px-4 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
