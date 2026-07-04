import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { ShortcutLink } from "../types";

const KEYWORD_ICON_MAP: Record<string, string> = {
    relatorio: "analytics",
    pdf: "picture_as_pdf",
    chart: "analytics",
    grafico: "analytics",
    sistema: "settings",
    painel: "dashboard",
    config: "settings",
    escala: "calendar_month",
    cronograma: "calendar_month",
    agenda: "calendar_month",
    calendario: "calendar_month",
    sdia: "article",
    documento: "article",
    oficio: "article",
    membro: "group",
    equipe: "group",
    usuario: "person",
    link: "link",
    atalho: "link",
    site: "language",
    web: "language",
    url: "link",
    tarefa: "assignment",
    task: "assignment",
    afazeres: "assignment",
    todo: "check_box",
    capacidade: "speed",
    trafego: "monitoring",
    atc: "flight_takeoff",
    fluxo: "account_tree",
    espaco: "public",
    aereo: "flight",
    voo: "flight",
    chat: "chat",
    mensagem: "chat",
    comunicacao: "forum",
    whatsapp: "chat",
    telegram: "send",
    teams: "groups",
    email: "mail",
    correio: "mail",
    gmail: "mail",
    outlook: "mail",
    pasta: "folder",
    drive: "cloud",
    nuvem: "cloud",
    arquivos: "folder",
    ajuda: "help",
    suporte: "support_agent",
    manual: "menu_book",
    alerta: "warning",
    urgente: "priority_high",
    aviso: "notification_important",
    banco: "database",
    dados: "database",
    sql: "database",
    supabase: "database",
};

const AVAILABLE_ICONS = [
    { value: "", label: "Nenhum" },
    { value: "link", label: "Link" },
    { value: "analytics", label: "Relatórios" },
    { value: "dashboard", label: "Painel" },
    { value: "calendar_month", label: "Calendário" },
    { value: "assignment", label: "Tarefas" },
    { value: "group", label: "Equipe" },
    { value: "database", label: "Dados" },
    { value: "cloud", label: "Nuvem" },
    { value: "folder", label: "Arquivos" },
    { value: "chat", label: "Mensagens" },
    { value: "mail", label: "E-mail" },
    { value: "flight", label: "Voo" },
    { value: "speed", label: "Velocidade" },
    { value: "warning", label: "Alerta" },
    { value: "help", label: "Ajuda" },
    { value: "article", label: "Documento" },
    { value: "public", label: "Globo" },
];

const detectIcon = (title: string) => {
    const t = title.toLowerCase().normalize("NFD").replace(
        /[\u0300-\u036f]/g,
        "",
    );
    for (const [key, icon] of Object.entries(KEYWORD_ICON_MAP)) {
        if (t.includes(key)) return icon;
    }
    return "";
};

const Shortcuts: React.FC = () => {
    const [links, setLinks] = useState<ShortcutLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [isEditMode, setIsEditMode] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [linkToDelete, setLinkToDelete] = useState<ShortcutLink | null>(null);

    const [formData, setFormData] = useState<Partial<ShortcutLink>>({
        titulo: "",
        link: "",
        descricao: "",
        icon: "",
        sector: "CH",
    });

    const [selectedFilter, setSelectedFilter] = useState("Todos");

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
        setCurrentUser(user);
        if (user.sector) {
            fetchLinks(user.sector);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchLinks = async (sector: string) => {
        try {
            setLoading(true);
            let query = supabase.from("links").select("*").order("titulo", {
                ascending: true,
            });

            if (sector !== "CH") {
                query = query.eq("sector", sector);
            }

            const { data, error } = await query;

            if (error) throw error;
            setLinks(data || []);
        } catch (err: any) {
            console.error("Erro ao buscar atalhos:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        const autoIcon = detectIcon(newTitle);
        setFormData((prev) => ({
            ...prev,
            titulo: newTitle,
            icon: prev.icon && prev.icon !== "" && autoIcon !== prev.icon &&
                    newTitle.length > 2
                ? prev.icon
                : autoIcon,
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.titulo || !formData.link || !currentUser?.sector) return;

        try {
            setIsSaving(true);
            const payload = {
                titulo: formData.titulo,
                link: formData.link,
                descricao: formData.descricao || null,
                icon: formData.icon || null,
                sector: currentUser.sector === "CH"
                    ? (formData.sector || "CH")
                    : currentUser.sector,
            };

            if (formData.id) {
                const { error } = await supabase
                    .from("links")
                    .update(payload)
                    .eq("id", formData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("links")
                    .insert([payload]);
                if (error) throw error;
            }

            setShowModal(false);
            setFormData({
                titulo: "",
                link: "",
                descricao: "",
                icon: "",
                sector: "CH",
            });
            fetchLinks(currentUser.sector);
        } catch (err: any) {
            console.error("Erro ao salvar atalho:", err.message);
            alert("Erro ao salvar atalho: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!linkToDelete) return;
        try {
            setIsSaving(true);
            const { error } = await supabase
                .from("links")
                .delete()
                .eq("id", linkToDelete.id);
            if (error) throw error;
            setLinkToDelete(null);
            fetchLinks(currentUser.sector);
        } catch (err: any) {
            console.error("Erro ao deletar atalho:", err.message);
            alert("Erro ao deletar atalho: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = (link: ShortcutLink) => {
        setFormData({
            id: link.id,
            titulo: link.titulo,
            link: link.link,
            descricao: link.descricao || "",
            icon: link.icon || "",
            sector: link.sector || "CH",
        });
        setShowModal(true);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-[#0d141b] dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">
                        Atalhos
                    </h2>
                    <p className="text-[#4c739a] dark:text-slate-400 mt-1">
                        Acesse rapidamente os links importantes do seu setor.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setFormData({
                                titulo: "",
                                link: "",
                                descricao: "",
                                icon: "",
                                sector: "CH",
                            });
                            setShowModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 h-11 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-lg shadow-primary/20 whitespace-nowrap active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            add
                        </span>
                        Criar Atalho
                    </button>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`inline-flex items-center justify-center gap-2 px-5 h-11 rounded-lg font-bold transition-all border active:scale-95 whitespace-nowrap ${
                            isEditMode
                                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/30"
                                : "bg-white dark:bg-slate-900 text-[#4c739a] dark:text-slate-300 border-[#e7edf3] dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm"
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {isEditMode ? "close" : "edit"}
                        </span>
                        {isEditMode ? "Finalizar Edição" : "Editar Atalhos"}
                    </button>
                </div>
            </div>

            {currentUser?.sector === "CH" && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                    {["Todos", "CP", "EA", "CH"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setSelectedFilter(f)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                                selectedFilter === f
                                    ? "bg-primary text-white shadow-md"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                        >
                            {f === "Todos"
                                ? "Todos os Setores"
                                : f === "CP"
                                ? "Capacidade ATC"
                                : f === "EA"
                                ? "Espaço Aéreo"
                                : "Chefia"}
                        </button>
                    ))}
                </div>
            )}

            {/* Links Grid */}
            {loading
                ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary">
                        </div>
                    </div>
                )
                : (currentUser?.sector === "CH" && selectedFilter !== "Todos"
                        ? links.filter((l) => l.sector === selectedFilter)
                        : links).length > 0
                ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {(currentUser?.sector === "CH" &&
                                selectedFilter !== "Todos"
                            ? links.filter((l) => l.sector === selectedFilter)
                            : links).map((link) => (
                                <div
                                    key={link.id}
                                    className="relative bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group overflow-hidden flex flex-col h-full"
                                >
                                    {isEditMode
                                        ? (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        openEditModal(link)}
                                                    className="absolute top-2 left-2 p-2 bg-white/90 dark:bg-slate-800/90 text-[#4c739a] hover:text-primary rounded-lg shadow-sm z-10 transition-colors"
                                                    title="Editar Atalho"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        edit
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setLinkToDelete(link)}
                                                    className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-slate-800/90 text-[#4c739a] hover:text-red-500 rounded-lg shadow-sm z-10 transition-colors"
                                                    title="Deletar Atalho"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        delete
                                                    </span>
                                                </button>
                                                <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-xl pointer-events-none">
                                                </div>
                                            </>
                                        )
                                        : null}

                                    <a
                                        href={link.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex-1 p-6 flex flex-col items-center justify-center text-center gap-3 transition-transform ${
                                            isEditMode
                                                ? "pointer-events-none opacity-60"
                                                : "hover:-translate-y-1"
                                        }`}
                                    >
                                        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                            <span className="material-symbols-outlined text-[28px]">
                                                {link.icon || "link"}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-[#0d141b] dark:text-white line-clamp-2">
                                                {link.titulo}
                                            </h3>
                                            {link.descricao && (
                                                <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1 line-clamp-2">
                                                    {link.descricao}
                                                </p>
                                            )}
                                        </div>
                                    </a>
                                </div>
                            ))}
                    </div>
                )
                : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm p-12 text-center flex flex-col items-center justify-center">
                        <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                            <span className="material-symbols-outlined text-4xl">
                                link_off
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">
                            Nenhum atalho encontrado
                        </h3>
                        <p className="text-[#4c739a] dark:text-slate-400 max-w-md">
                            Seu setor ainda não possui nenhum atalho cadastrado.
                            Clique no botão "Criar Atalho" acima para adicionar
                            o primeiro.
                        </p>
                    </div>
                )}

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800 flex justify-between items-center bg-[#f8fafc] dark:bg-slate-800/50">
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    {formData.id ? "edit" : "add_link"}
                                </span>
                                {formData.id ? "Editar Atalho" : "Novo Atalho"}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 text-[#4c739a] hover:text-[#0d141b] dark:hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">
                                    close
                                </span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form
                                id="shortcutForm"
                                onSubmit={handleSave}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Título
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.titulo}
                                        onChange={handleTitleChange}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        placeholder="Ex: Escala de Serviço"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Link
                                    </label>
                                    <input
                                        required
                                        type="url"
                                        value={formData.link}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                link: e.target.value,
                                            })}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Descrição (Opcional)
                                    </label>
                                    <textarea
                                        value={formData.descricao}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                descricao: e.target.value,
                                            })}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 min-h-[80px] resize-y"
                                        placeholder="Pequena descrição sobre o atalho..."
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Ícone
                                    </label>
                                    <div className="flex gap-3 items-center">
                                        <div className="size-12 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary text-[24px]">
                                                {formData.icon || "link"}
                                            </span>
                                        </div>
                                        <select
                                            value={formData.icon || ""}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    icon: e.target.value,
                                                })}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        >
                                            {AVAILABLE_ICONS.map((opt) => (
                                                <option
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="text-[10px] text-[#4c739a] mt-1">
                                        O ícone é sugerido automaticamente com
                                        base no título, mas pode ser alterado
                                        manualmente.
                                    </span>
                                </div>
                                {currentUser?.sector === "CH" && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Setor do Atalho
                                        </label>
                                        <select
                                            value={formData.sector || "CH"}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    sector: e.target.value,
                                                })}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        >
                                            <option value="CH">
                                                Chefia
                                            </option>
                                            <option value="CP">
                                                Capacidade ATC
                                            </option>
                                            <option value="EA">
                                                Espaço Aéreo
                                            </option>
                                        </select>
                                    </div>
                                )}
                            </form>
                        </div>
                        <div className="p-4 border-t border-[#e7edf3] dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-800/50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="shortcutForm"
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                            >
                                {isSaving
                                    ? (
                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin">
                                        </div>
                                    )
                                    : formData.id
                                    ? (
                                        "Atualizar"
                                    )
                                    : (
                                        "Salvar"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {linkToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="size-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[32px]">
                                    delete_forever
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">
                                Confirmar Exclusão
                            </h3>
                            <p className="text-[#4c739a] dark:text-slate-400">
                                Tem certeza que deseja deletar o atalho{" "}
                                <span className="font-bold text-[#0d141b] dark:text-white">
                                    "{linkToDelete.titulo}"
                                </span>?
                                <br />Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50">
                            <button
                                onClick={() => setLinkToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                disabled={isSaving}
                            >
                                {isSaving
                                    ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white">
                                        </div>
                                    )
                                    : (
                                        "Excluir Registro"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shortcuts;
