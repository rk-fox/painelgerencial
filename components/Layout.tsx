import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { canAccessScheduleAndReports, findSeniorityTies, isOfficer } from "../utils/permissions";

const Layout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newTasks, setNewTasks] = useState<any[]>([]);
  const [hasSeniorityTieAlert, setHasSeniorityTieAlert] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [canAccessScheduleReports, setCanAccessScheduleReports] = useState(true);
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Fetch full profile from members using user_id
        const { data: profile, error } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (profile) {
          // Check for active CH delegations
          let effectiveSector = profile.sector;
          const today = new Date().toISOString().split("T")[0];

          const { data: delegation } = await supabase
            .from("ch_delegations")
            .select("*")
            .eq("beneficiary_id", profile.id)
            .eq("is_active", true)
            .lte("start_date", today)
            .or(`end_date.is.null,end_date.gte.${today}`)
            .maybeSingle();

          if (delegation) {
            effectiveSector = "CH";
          }

          const userWithSession = {
            ...profile,
            sector: effectiveSector,
            last_login: session.user.last_sign_in_at,
          };
          setCurrentUser(userWithSession);
          checkNotifications(userWithSession);
          checkSeniorityTies(userWithSession);
          localStorage.setItem("currentUser", JSON.stringify(userWithSession));
          canAccessScheduleAndReports(userWithSession).then(setCanAccessScheduleReports);
        } else {
          // If no profile found for auth user
          localStorage.removeItem("currentUser");
          navigate("/");
        }
      } else {
        // No active Supabase session
        localStorage.removeItem("currentUser");
        navigate("/");
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          localStorage.removeItem("currentUser");
          navigate("/");
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationsOpen &&
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const checkNotifications = async (user: any) => {
    if (!user || (!user.last_login && !user.last_sign_in_at)) return;
    let lastLogin = user.last_login || user.last_sign_in_at;

    const clearedAt = localStorage.getItem("notificationsClearedAt");
    if (clearedAt && new Date(clearedAt) > new Date(lastLogin)) {
      lastLogin = clearedAt;
    }

    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .gt("created_at", lastLogin)
        .contains("specialties", [user.specialty]);

      if (user.sector && user.sector !== "CH") {
        query = query.eq("sector", user.sector);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        setNewTasks(data);
      }
    } catch (err: any) {
      console.error("Error fetching notifications:", err.message);
    }
  };

  const checkSeniorityTies = async (user: any) => {
    if (!user) return;
    try {
      const { data: allMembers } = await supabase
        .from("members")
        .select("id, name, war_name, rank, abrev, last_promotion_date, guia_antiguidade, sector, encarregado");

      if (allMembers) {
        const ties = findSeniorityTies(allMembers);
        const unresolved = ties.filter((t) => !t.isResolved);
        if (unresolved.length === 0) {
          setHasSeniorityTieAlert(false);
          return;
        }

        // 1. Se o próprio usuário estiver envolvido no empate, sempre notifica
        const userInTie = unresolved.some((t) => t.members.some((m) => m.id === user.id));
        if (userInTie) {
          setHasSeniorityTieAlert(true);
          return;
        }

        // 2. Oficiais e Chefia (CH) sempre recebem a notificação
        const isUserOfficer = isOfficer(user.rank, user.abrev) || user.sector === "CH";
        if (isUserOfficer) {
          setHasSeniorityTieAlert(true);
          return;
        }

        // 3. Regra por setor (CP, EA)
        const userSector = user.sector;
        if (!userSector) {
          setHasSeniorityTieAlert(true);
          return;
        }

        // Verifica se existem empates no setor do usuário
        const sectorTies = unresolved.filter((t) => t.members.some((m) => m.sector === userSector));
        if (sectorTies.length === 0) {
          setHasSeniorityTieAlert(false);
          return;
        }

        // Verifica se o setor possui algum encarregado cadastrado
        const sectorHasEncarregado = allMembers.some((m) => m.sector === userSector && m.encarregado);

        if (sectorHasEncarregado) {
          // Se tem encarregado, aparece para os encarregados
          setHasSeniorityTieAlert(!!user.encarregado);
        } else {
          // Se não tem encarregado, aparece para todos do setor
          setHasSeniorityTieAlert(true);
        }
      }
    } catch (e) {
      console.error("Error checking seniority ties:", e);
    }
  };

  const clearNotifications = () => {
    setNewTasks([]);
    localStorage.setItem("notificationsClearedAt", new Date().toISOString());
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  // Format current date in Portuguese
  const formatDate = () => {
    const date = new Date();
    const days = [
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
    ];
    const months = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${day} de ${month} de ${year}`;
  };

  const getSectorLabel = () => {
    if (!currentUser?.sector) return "Painel Gerencial";
    switch (currentUser.sector) {
      case "CP":
        return "Capacidade ATC";
      case "EA":
        return "Espaço Aéreo";
      case "CH":
        return "Subdivisão Estratégica";
      default:
        return "Painel Gerencial";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f8] dark:bg-background-dark text-[#0d141b] dark:text-slate-200">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
        className={`
          bg-white dark:bg-slate-900 border-r border-[#e7edf3] dark:border-slate-800 flex flex-col h-screen z-50 shrink-0 transition-all duration-300
          fixed md:sticky top-0
          ${isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}
          md:translate-x-0 ${isSidebarCollapsed ? "md:w-20" : "md:w-64"}
        `}
      >
        <div
          className={`p-6 flex items-center gap-3 ${
            isSidebarCollapsed ? "md:justify-center" : ""
          }`}
        >
          <img
            src="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/cgna-logo.png"
            alt="CGNA"
            className="size-8 min-w-[32px] shadow-lg object-contain"
          />
          {/* On mobile drawer is always w-64 so always show. On desktop, hide when collapsed */}
          {!isSidebarCollapsed && (
            <h2 className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] truncate uppercase hidden md:block">
              CGNA
            </h2>
          )}
          <h2 className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] truncate uppercase md:hidden">
            CGNA
          </h2>
        </div>

        <nav
          className={`flex-1 px-4 space-y-1 mt-4 overflow-y-auto ${
            isSidebarCollapsed ? "md:overflow-hidden" : ""
          }`}
        >
          {currentUser?.sector !== "CH" && (
            <SidebarItem
              to="/app/dashboard"
              icon="dashboard"
              label="Dashboard"
              collapsed={isSidebarCollapsed}
              onMobileClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <SidebarItem
            to="/app/tasks/new"
            icon="assignment"
            label="Tarefas"
            collapsed={isSidebarCollapsed}
            onMobileClick={() => setIsMobileMenuOpen(false)}
          />
          <SidebarItem
            to="/app/members"
            icon="group"
            label="Membros"
            collapsed={isSidebarCollapsed}
            onMobileClick={() => setIsMobileMenuOpen(false)}
          />
          {canAccessScheduleReports && (
            <>
              <SidebarItem
                to="/app/schedule"
                icon="calendar_month"
                label="Cronograma"
                collapsed={isSidebarCollapsed}
                onMobileClick={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                to="/app/reports"
                icon="analytics"
                label="Relatórios"
                collapsed={isSidebarCollapsed}
                onMobileClick={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}
          <SidebarItem
            to="/app/sdia"
            icon="report"
            label="SDIA"
            collapsed={isSidebarCollapsed}
            onMobileClick={() => setIsMobileMenuOpen(false)}
          />
          <SidebarItem
            to="/app/shortcuts"
            icon="link"
            label="Atalhos"
            collapsed={isSidebarCollapsed}
            onMobileClick={() => setIsMobileMenuOpen(false)}
          />
          {(currentUser?.sector === "CP" || currentUser?.sector === "EA") && (
            <SidebarItem
              to="/app/quadro-branco"
              icon="view_kanban"
              label="Quadro Branco"
              collapsed={isSidebarCollapsed}
              onMobileClick={() => setIsMobileMenuOpen(false)}
            />
          )}
          <SidebarItem
            to="/app/strategic-summary"
            icon="play_arrow"
            label="Resumo Estratégico"
            collapsed={isSidebarCollapsed}
            onMobileClick={() => setIsMobileMenuOpen(false)}
          />
        </nav>

        <div className="p-4 border-t border-[#e7edf3] dark:border-slate-800 space-y-4">
          <div
            className={`flex items-center gap-3 px-2 ${
              isSidebarCollapsed ? "md:justify-center" : ""
            }`}
          >
            {currentUser
              ? (
                <>
                  <div
                    className="min-w-[40px] h-10 w-10 bg-center bg-no-repeat bg-cover rounded-full border border-[#e7edf3] dark:border-slate-700 shadow-sm"
                    style={{
                      backgroundImage: `url("${
                        currentUser.avatar ||
                        "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
                      }")`,
                    }}
                  />
                  {/* On desktop, show user info only when sidebar expanded. On mobile always show. */}
                  {!isSidebarCollapsed && (
                    <div className="overflow-hidden hidden md:block">
                      <p className="text-xs font-bold truncate text-[#0d141b] dark:text-white">
                        {currentUser.abrev} {currentUser.war_name}
                      </p>
                      <p className="text-[10px] text-[#4c739a] dark:text-slate-400 font-bold truncate uppercase">
                        {currentUser.specialty}
                      </p>
                    </div>
                  )}
                  {/* Mobile: always show */}
                  <div className="overflow-hidden md:hidden">
                    <p className="text-xs font-bold truncate text-[#0d141b] dark:text-white">
                      {currentUser.abrev} {currentUser.war_name}
                    </p>
                    <p className="text-[10px] text-[#4c739a] dark:text-slate-400 font-bold truncate uppercase">
                      {currentUser.specialty}
                    </p>
                  </div>
                </>
              )
              : (
                <div className="min-w-[40px] h-10 w-10 rounded-full bg-slate-100 animate-pulse" />
              )}
          </div>

          <div
            className={`flex items-center justify-between px-2 ${
              isSidebarCollapsed ? "md:flex-col md:gap-4 md:justify-center md:px-0" : ""
            }`}
          >
            <div className="relative">
              <button
                ref={bellButtonRef}
                className="text-[#4c739a] hover:text-primary transition-all active:scale-95 relative"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                title="Notificações"
              >
                <span className="material-symbols-outlined text-[20px]">
                  notifications
                </span>
                {(newTasks.length > 0 || hasSeniorityTieAlert) && (
                  <span className={`absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${hasSeniorityTieAlert ? "bg-amber-500 animate-pulse" : "bg-primary"}`} />
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationsOpen && (
                <div
                  ref={notificationRef}
                  className="absolute left-0 bottom-full mb-3 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 z-[110] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <div className="p-4 border-b border-[#e7edf3] dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d141b] dark:text-white">
                      Notificações
                    </h3>
                    <div className="flex items-center gap-2">
                      {newTasks.length > 0 && (
                        <button
                          onClick={clearNotifications}
                          className="text-[10px] text-[#4c739a] hover:text-primary transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {newTasks.length + (hasSeniorityTieAlert ? 1 : 0)}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {hasSeniorityTieAlert && (
                      <div
                        className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                        onClick={() => {
                          navigate("/app/members");
                          setIsNotificationsOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Antiguidade
                          </span>
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            Ação Necessária
                          </span>
                        </div>
                        <p className="text-xs font-bold text-amber-950 dark:text-amber-100 leading-tight">
                          Empate de antiguidade detectado entre militares. Clique para acessar a equipe e definir a ordem.
                        </p>
                      </div>
                    )}
                    {newTasks.length === 0 && !hasSeniorityTieAlert
                      ? (
                        <div className="p-4 text-center text-[#4c739a] text-xs italic">
                          Nenhuma nova notificação.
                        </div>
                      )
                      : (
                        <div className="divide-y divide-[#e7edf3] dark:divide-slate-800">
                          {newTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                              onClick={() => {
                                navigate(
                                  currentUser?.sector === "CH"
                                    ? "/app/tasks/new"
                                    : "/app/dashboard",
                                );
                                setIsNotificationsOpen(false);
                              }}
                            >
                              <div className="flex items-start gap-2 mb-1">
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Nova
                                </span>
                                <span className="text-[10px] font-bold text-[#4c739a]">
                                  {new Date(task.created_at).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-[#0d141b] dark:text-white line-clamp-2 leading-tight">
                                {task.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
            <button
              className="text-[#4c739a] hover:text-primary transition-all active:scale-95"
              title="Configurações"
            >
              <span className="material-symbols-outlined text-[20px]">
                settings
              </span>
            </button>
            <button
              className="text-[#4c739a] hover:text-primary transition-all active:scale-95"
              onClick={() => document.documentElement.classList.toggle("dark")}
              title="Alternar Tema"
            >
              <span className="material-symbols-outlined text-[20px] dark:hidden">
                dark_mode
              </span>
              <span className="material-symbols-outlined text-[20px] hidden dark:block">
                light_mode
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="text-[#4c739a] hover:text-red-500 transition-all active:scale-95"
              title="Sair"
            >
              <span className="material-symbols-outlined text-[20px]">
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-[#e7edf3] dark:border-slate-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 md:gap-8 flex-1">
            {/* Hamburger button - mobile only */}
            <button
              className="md:hidden text-[#4c739a] hover:text-primary transition-colors active:scale-95 p-1"
              onClick={() => setIsMobileMenuOpen(true)}
              title="Menu"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <h1 className="text-[#0d141b] dark:text-white font-bold text-lg whitespace-nowrap hidden md:block">
              Painel Gerencial
            </h1>
            {/* Mobile: show logo + sector */}
            <div className="flex items-center gap-2 md:hidden">
              <img
                src="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/cgna-logo.png"
                alt="CGNA"
                className="size-7 object-contain"
              />
              <span className="text-[11px] font-bold text-[#4c739a] uppercase tracking-wider">
                {getSectorLabel()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-[#4c739a] uppercase tracking-wider">
                {getSectorLabel()}
              </p>
              <p className="text-[10px] text-[#4c739a] dark:text-slate-500">
                Rio de Janeiro, Brasil
              </p>
              <p className="text-[10px] text-[#4c739a] dark:text-slate-500 capitalize">
                {formatDate()}
              </p>
            </div>
            <button className="size-8 flex items-center justify-center bg-[#f8fafc] dark:bg-slate-800 rounded-full text-[#4c739a] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-[20px]">
                help
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-[#f6f7f8] dark:bg-background-dark scroll-smooth">
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
  onMobileClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = (
  { to, icon, label, collapsed, onMobileClick },
) => {
  return (
    <NavLink
      to={to}
      onClick={onMobileClick}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative
        ${
        isActive
          ? "bg-primary/5 text-primary"
          : "text-[#4c739a] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
      }
        ${collapsed ? "md:justify-center" : ""}
      `}
    >
      <span
        className={`material-symbols-outlined ${collapsed ? "md:text-2xl" : ""}`}
      >
        {icon}
      </span>
      {/* Desktop: conditionally show label */}
      <span className={`nav-text text-sm font-medium whitespace-nowrap ${collapsed ? "md:hidden" : ""}`}>
        {label}
      </span>
      {/* Desktop tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 hidden md:block">
          {label}
        </div>
      )}
    </NavLink>
  );
};

export default Layout;
