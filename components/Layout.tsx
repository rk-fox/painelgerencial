import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';

const Layout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  // Format current date in Portuguese
  const formatDate = () => {
    const date = new Date();
    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${day} de ${month} de ${year}`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f8] dark:bg-background-dark text-[#0d141b] dark:text-slate-200">
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
        className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-[#e7edf3] dark:border-slate-800 flex flex-col h-screen sticky top-0 z-50 shrink-0 transition-all duration-300`}
      >
        <div className={`p-6 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <img
            src="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/cgna-logo.png"
            alt="CGNA"
            className="size-8 min-w-[32px] shadow-lg object-contain"
          />
          {!isSidebarCollapsed && (
            <h2 className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] truncate uppercase">CGNA</h2>
          )}
        </div>

        <nav className={`flex-1 px-4 space-y-1 mt-4 ${isSidebarCollapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <SidebarItem
            to="/app/dashboard"
            icon="dashboard"
            label="Dashboard"
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem
            to="/app/tasks/new"
            icon="assignment"
            label="Tarefas"
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem
            to="/app/members"
            icon="group"
            label="Membros"
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem
            to="/app/schedule"
            icon="calendar_month"
            label="Cronograma"
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem
            to="/app/reports"
            icon="analytics"
            label="Relatórios"
            collapsed={isSidebarCollapsed}
          />
        </nav>

        <div className="p-4 border-t border-[#e7edf3] dark:border-slate-800 space-y-4">
          <div className={`flex items-center gap-3 px-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            {currentUser ? (
              <>
                <div
                  className="min-w-[40px] h-10 w-10 bg-center bg-no-repeat bg-cover rounded-full border border-[#e7edf3] dark:border-slate-700 shadow-sm"
                  style={{ backgroundImage: `url("${currentUser.avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}")` }}
                />
                {!isSidebarCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold truncate text-[#0d141b] dark:text-white">
                      {currentUser.abrev} {currentUser.war_name}
                    </p>
                    <p className="text-[10px] text-[#4c739a] dark:text-slate-400 font-bold truncate uppercase">{currentUser.specialty}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="min-w-[40px] h-10 w-10 rounded-full bg-slate-100 animate-pulse" />
            )}
          </div>

          <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-4' : 'justify-between px-2'}`}>
            <button className="text-[#4c739a] hover:text-primary transition-all active:scale-95 relative" title="Notificações">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
            </button>
            <button className="text-[#4c739a] hover:text-primary transition-all active:scale-95" title="Configurações">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
            <button
              className="text-[#4c739a] hover:text-primary transition-all active:scale-95"
              onClick={() => document.documentElement.classList.toggle('dark')}
              title="Alternar Tema"
            >
              <span className="material-symbols-outlined text-[20px] dark:hidden">dark_mode</span>
              <span className="material-symbols-outlined text-[20px] hidden dark:block">light_mode</span>
            </button>
            <button onClick={handleLogout} className="text-[#4c739a] hover:text-red-500 transition-all active:scale-95" title="Sair">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-[#e7edf3] dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-8 flex-1">
            <h1 className="text-[#0d141b] dark:text-white font-bold text-lg whitespace-nowrap hidden md:block">Painel Gerencial</h1>
            <div className="max-w-md w-full relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] text-xl">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-[#f8fafc] dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-[#4c739a]"
                placeholder="Buscar membros, especialidades, tarefas..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-[#4c739a] uppercase tracking-wider">CAPACIDADE ATC</p>
              <p className="text-[10px] text-[#4c739a] dark:text-slate-500">Rio de Janeiro, Brasil</p>
              <p className="text-[10px] text-[#4c739a] dark:text-slate-500 capitalize">{formatDate()}</p>
            </div>
            <button className="size-8 flex items-center justify-center bg-[#f8fafc] dark:bg-slate-800 rounded-full text-[#4c739a] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">help</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f6f7f8] dark:bg-background-dark scroll-smooth">
          <div className="max-w-[1400px] mx-auto min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

interface SidebarItemProps {
  to: string;
  icon: string;
  label: string;
  collapsed: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, collapsed }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative
        ${isActive
          ? 'bg-primary/5 text-primary'
          : 'text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      <span className={`material-symbols-outlined ${collapsed ? 'text-2xl' : ''}`}>{icon}</span>
      {!collapsed && <span className="nav-text text-sm font-medium whitespace-nowrap">{label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </NavLink>
  );
};

export default Layout;
