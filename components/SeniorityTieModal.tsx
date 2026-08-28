import React, { useState } from "react";
import { supabase } from "../supabase";
import { Member } from "../types";
import { SeniorityTieGroup } from "../utils/permissions";
import { formatLocalDate } from "../utils/dateUtils";

interface SeniorityTieModalProps {
    isOpen: boolean;
    onClose: () => void;
    tieGroups: SeniorityTieGroup[];
    onSuccess: () => void;
}

const SeniorityTieModal: React.FC<SeniorityTieModalProps> = ({
    isOpen,
    onClose,
    tieGroups,
    onSuccess,
}) => {
    // Local state to manage guia_antiguidade assignments per member
    const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);
    const [memberValues, setMemberValues] = useState<Record<string, number | "">>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initialize/sync memberValues when tieGroups or selectedGroup changes
    React.useEffect(() => {
        if (tieGroups.length > 0 && tieGroups[selectedGroupIndex]) {
            const group = tieGroups[selectedGroupIndex];
            const initial: Record<string, number | ""> = {};
            group.members.forEach((m, idx) => {
                initial[m.id] = m.guia_antiguidade !== null && m.guia_antiguidade !== undefined
                    ? m.guia_antiguidade
                    : idx + 1;
            });
            setMemberValues(initial);
            setError(null);
            setSuccessMessage(null);
        }
    }, [tieGroups, selectedGroupIndex]);

    if (!isOpen || tieGroups.length === 0) return null;

    const currentGroup = tieGroups[selectedGroupIndex] || tieGroups[0];

    const handleValueChange = (memberId: string, valueStr: string) => {
        const val = valueStr === "" ? "" : parseInt(valueStr, 10);
        setMemberValues((prev) => ({
            ...prev,
            [memberId]: val,
        }));
    };

    const handleQuickOrder = () => {
        const updated: Record<string, number | ""> = {};
        currentGroup.members.forEach((m, idx) => {
            updated[m.id] = idx + 1;
        });
        setMemberValues(updated);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            // Validation: ensure all values are numbers and distinct
            const values = currentGroup.members.map((m) => memberValues[m.id]);
            if (values.some((v) => v === "" || isNaN(Number(v)))) {
                setError("Por favor, preencha o número do guia de antiguidade para todos os militares do grupo.");
                setLoading(false);
                return;
            }

            const numValues = values.map(Number);
            const distinctValues = new Set(numValues);
            if (distinctValues.size !== numValues.length) {
                setError("Cada militar deve possuir um número de antiguidade distinto (ex: 1 para o mais antigo, 2 para o seguinte, etc.).");
                setLoading(false);
                return;
            }

            // Update each member in Supabase
            for (const member of currentGroup.members) {
                const guia = Number(memberValues[member.id]);
                const { error: updateError } = await supabase
                    .from("members")
                    .update({ guia_antiguidade: guia })
                    .eq("id", member.id);

                if (updateError) throw updateError;
            }

            setSuccessMessage("Ordem de antiguidade atualizada com sucesso!");
            setTimeout(() => {
                onSuccess();
                if (selectedGroupIndex < tieGroups.length - 1) {
                    setSelectedGroupIndex((prev) => prev + 1);
                } else {
                    onClose();
                }
            }, 1000);
        } catch (err: any) {
            console.error("Error updating seniority:", err);
            setError("Erro ao salvar ordem de antiguidade: " + (err.message || "Erro desconhecido"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined text-2xl">
                                military_tech
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                Desempate de Antiguidade Militar
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Militares com mesmo posto e mesma data de promoção
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="size-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {/* Groups Navigation Tabs if multiple groups */}
                    {tieGroups.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {tieGroups.map((group, idx) => (
                                <button
                                    key={group.key}
                                    onClick={() => setSelectedGroupIndex(idx)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                        selectedGroupIndex === idx
                                            ? "bg-primary text-white shadow-md shadow-primary/25"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                    }`}
                                >
                                    <span>{group.abrev || group.rank}</span>
                                    <span className="opacity-75">({group.members.length})</span>
                                    {group.isResolved && (
                                        <span className="material-symbols-outlined text-xs text-green-300">
                                            check_circle
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Group Information Banner */}
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">
                            warning
                        </span>
                        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <p className="font-bold">
                                Empate em {currentGroup.rank} ({formatLocalDate(currentGroup.last_promotion_date)})
                            </p>
                            <p className="text-amber-800/80 dark:text-amber-300/80">
                                Informe o número do <strong>Guia de Antiguidade</strong> (Almanaque) para ordenar a precedência. O militar com <strong>menor número (ex: 1)</strong> é considerado o mais antigo na escala de serviço e viagens.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">error</span>
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-300 font-semibold flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            {successMessage}
                        </div>
                    )}

                    {/* Members List in Group */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                            <span>Militar</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleQuickOrder}
                                    className="text-primary hover:underline text-xs font-semibold cursor-pointer"
                                >
                                    Preencher 1, 2, 3...
                                </button>
                                <span>Guia de Antiguidade</span>
                            </div>
                        </div>

                        {currentGroup.members.map((member) => {
                            const val = memberValues[member.id] ?? "";
                            return (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-11 rounded-xl bg-primary/10 overflow-hidden shrink-0 flex items-center justify-center text-primary font-bold">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="size-full object-cover"
                                                />
                                            ) : (
                                                <span>{(member.war_name || member.name).charAt(0)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                                <span className="text-primary">{member.abrev || member.rank}</span>
                                                <span>{member.war_name || member.name}</span>
                                            </div>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] block">
                                                {member.name}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="9999"
                                                value={val}
                                                onChange={(e) => handleValueChange(member.id, e.target.value)}
                                                className="w-24 text-center font-bold text-sm h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                                                placeholder="Ex: 1"
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                                            º
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-sm">save</span>
                        {loading ? "Salvando..." : "Salvar Ordenação"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SeniorityTieModal;
