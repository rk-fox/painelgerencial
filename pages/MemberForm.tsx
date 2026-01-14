import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';

const rankMap: Record<string, string> = {
  'Major': 'Maj.',
  'Capitão': 'Cap.',
  '1º Tenente': 'Ten.',
  '2º Tenente': 'Ten.',
  'Suboficial': 'SO.',
  '1º Sargento': 'Sgt.',
  '2º Sargento': 'Sgt.',
  '3º Sargento': 'Sgt.',
  'Civil': 'Cv.'
};

const MemberForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    fullname: '',
    war_name: '',
    rank: '',
    entry_date: '',
    last_promotion_date: '',
    specialty: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (isEditMode) {
      fetchMemberData();
    }
  }, [id]);

  const fetchMemberData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          fullname: data.name || '',
          war_name: data.war_name || '',
          rank: data.rank || '',
          entry_date: data.entry_date || '',
          last_promotion_date: data.last_promotion_date || '',
          specialty: data.specialty || '',
          email: data.email || '',
          phone: data.phone || '',
        });
        if (data.avatar) {
          setAvatarPreview(data.avatar);
        }
      }
    } catch (err: any) {
      console.error('Error fetching member:', err.message);
      setError('Erro ao carregar dados do membro');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value, name } = e.target;
    const field = id || name;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let avatarUrl = avatarPreview || '';

      // Upload avatar if exists
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(filePath, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('member-photos')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      const memberData: any = {
        name: formData.fullname,
        war_name: formData.war_name,
        rank: formData.rank,
        abrev: rankMap[formData.rank] || '',
        entry_date: formData.entry_date,
        last_promotion_date: formData.last_promotion_date,
        specialty: formData.specialty,
        email: formData.email,
        phone: formData.phone,
        avatar: avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
      };

      if (!isEditMode) {
        memberData.status = 'Ativo';
        memberData.requires_password = true;
      }

      const query = isEditMode
        ? supabase.from('members').update(memberData).eq('id', id)
        : supabase.from('members').insert([memberData]);

      const { error: dbError } = await query;

      if (dbError) throw dbError;

      navigate('/app/members');
    } catch (err: any) {
      console.error('Error saving member:', err.message);
      setError(`Erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} membro: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
      {/* Breadcrumbs */}
      <nav className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => navigate('/app/dashboard')} className="text-[#4c739a] text-sm font-medium hover:underline">Início</button>
        <span className="text-[#4c739a] text-sm font-medium">/</span>
        <button onClick={() => navigate('/app/members')} className="text-[#4c739a] text-sm font-medium hover:underline">Equipe</button>
        <span className="text-[#4c739a] text-sm font-medium">/</span>
        <span className="text-[#0d141b] dark:text-white text-sm font-bold">{isEditMode ? 'Editar Membro' : 'Cadastro de Membro'}</span>
      </nav>

      {/* PageHeading */}
      <div className="mb-8">
        <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight mb-2">
          {isEditMode ? `Editando: ${formData.fullname}` : 'Cadastro de Membros da Equipe'}
        </h1>
        <p className="text-[#4c739a] text-base">
          {isEditMode ? 'Atualize as informações profissionais deste membro.' : 'Insira as informações do novo militar ou funcionário civil para integrar à seção técnica.'}
        </p>
      </div>

      {/* Registration Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl shadow-sm overflow-hidden mb-8">
        {/* HeadlineText inside Form */}
        <div className="px-8 pt-8 pb-2">
          <h3 className="text-[#0d141b] dark:text-white text-xl font-bold border-b border-[#e7edf3] dark:border-slate-800 pb-4">Informações Pessoais e Profissionais</h3>
        </div>
        <form className="p-8 space-y-6" onSubmit={handleSubmit}>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <label className="text-sm font-bold text-[#0d141b] dark:text-white self-start">Foto do Militar</label>
              <div className="relative group cursor-pointer">
                <div className="size-32 rounded-full border-4 border-slate-100 dark:border-slate-800 overflow-hidden bg-slate-50 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[48px] text-slate-300">person</span>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="material-symbols-outlined">photo_camera</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>
              <p className="text-[10px] text-[#4c739a]">PNG, JPG até 2MB</p>
            </div>

            <div className="flex-1 w-full space-y-6">
              {/* Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="fullname">Nome Completo</label>
                  <input
                    className="rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 w-full"
                    id="fullname"
                    placeholder="Ex: João da Silva Santos"
                    type="text"
                    required
                    value={formData.fullname}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="war_name">Nome de Guerra</label>
                  <input
                    className="rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 w-full"
                    id="war_name"
                    placeholder="Ex: Silva"
                    type="text"
                    required
                    value={formData.war_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Rank and Dates Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="rank">Graduação / Posto</label>
                  <select
                    className="rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 w-full"
                    id="rank"
                    required
                    value={formData.rank}
                    onChange={handleInputChange}
                  >
                    <option value="" disabled>Selecione</option>
                    <option value="Major">Major</option>
                    <option value="Capitão">Capitão</option>
                    <option value="1º Tenente">1º Tenente</option>
                    <option value="2º Tenente">2º Tenente</option>
                    <option value="Suboficial">Suboficial</option>
                    <option value="1º Sargento">1º Sargento</option>
                    <option value="2º Sargento">2º Sargento</option>
                    <option value="3º Sargento">3º Sargento</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="entry_date">Data de Entrada</label>
                  <input
                    className="rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 w-full"
                    id="entry_date"
                    type="date"
                    required
                    value={formData.entry_date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="last_promotion_date">Data Últ. Promoção</label>
                  <input
                    className="rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 w-full"
                    id="last_promotion_date"
                    type="date"
                    value={formData.last_promotion_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Specialty Row */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-[#0d141b] dark:text-white">Especialidade</label>
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer group">
                <input
                  className="hidden peer"
                  name="specialty"
                  type="radio"
                  value="BCT"
                  required
                  checked={formData.specialty === 'BCT'}
                  onChange={handleInputChange}
                />
                <div className="flex items-center justify-center h-12 border-2 border-[#d1d5db] dark:border-slate-700 rounded-lg peer-checked:border-primary peer-checked:bg-primary/5 text-[#4c739a] peer-checked:text-primary font-bold transition-all bg-white dark:bg-slate-800">
                  BCT (Controlador)
                </div>
              </label>
              <label className="flex-1 cursor-pointer group">
                <input
                  className="hidden peer"
                  name="specialty"
                  type="radio"
                  value="AIS"
                  checked={formData.specialty === 'AIS'}
                  onChange={handleInputChange}
                />
                <div className="flex items-center justify-center h-12 border-2 border-[#d1d5db] dark:border-slate-700 rounded-lg peer-checked:border-primary peer-checked:bg-primary/5 text-[#4c739a] peer-checked:text-primary font-bold transition-all bg-white dark:bg-slate-800">
                  AIS (Informações)
                </div>
              </label>
            </div>
          </div>

          {/* Contact Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="email">E-mail</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[#94a3b8] text-[20px]">mail</span>
                <input
                  className="w-full rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 pl-10 pr-4"
                  id="email"
                  placeholder="nome@mail.com"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#0d141b] dark:text-white" htmlFor="phone">Telefone / Ramal</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[#94a3b8] text-[20px]">call</span>
                <input
                  className="w-full rounded-lg border-[#d1d5db] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-primary focus:ring-primary h-12 pl-10 pr-4"
                  id="phone"
                  placeholder="(XX) XXXXX-XXXX"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 mt-6 border-t border-[#e7edf3] dark:border-slate-800">
            <button
              onClick={() => navigate('/app/members')}
              className="px-6 py-3 rounded-lg text-sm font-bold text-[#4c739a] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              type="button"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              className="px-8 py-3 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
              ) : (
                <span className="material-symbols-outlined text-[18px]">{isEditMode ? 'save' : 'person_add'}</span>
              )}
              {loading ? (isEditMode ? 'Salvando...' : 'Cadastrando...') : (isEditMode ? 'Salvar Alterações' : 'Cadastrar Membro')}
            </button>
          </div>
        </form>
      </div>
      <footer className="mt-8 text-center text-[#4c739a] text-xs pb-8">
        © 2024 CGNA - Centro de Gerenciamento da Navegação Aérea. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default MemberForm;