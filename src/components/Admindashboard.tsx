import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Users, Calendar, Link as LinkIcon, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Retreat } from '../lib/supabase';
import RetreatForm from './RetreatForm';
import ParticipantsList from './ParticipantsList';
import logoHomensDeFe from '../assets/logo-homens-de-fe.png';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedRetreat, setSelectedRetreat] = useState<Retreat | null>(null);
  const [editingRetreat, setEditingRetreat] = useState<Retreat | null>(null);
  const [retreatToDelete, setRetreatToDelete] = useState<Retreat | null>(null);
  const [isDeletingRetreat, setIsDeletingRetreat] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRetreats();
  }, []);

  const loadRetreats = async () => {
    try {
      const { data, error } = await supabase
        .from('retreats')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setRetreats(data || []);
    } catch (error) {
      console.error('Error loading retreats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetreatSaved = () => {
    setShowForm(false);
    setEditingRetreat(null);
    loadRetreats();
  };

  const copyShareLink = (shareLink: string) => {
    const fullUrl = `${window.location.origin}/inscricao/${shareLink}`;
    navigator.clipboard.writeText(fullUrl);
    alert('Link copiado para a área de transferência!');
  };

  const deleteRetreat = async () => {
    if (!retreatToDelete || isDeletingRetreat) return;
    setIsDeletingRetreat(true);
    try {
      const retreatId = retreatToDelete.id;
      const retreatName = retreatToDelete.name;

      const { error } = await supabase.from('retreats').delete().eq('id', retreatId);
      if (error) throw error;

      // Some RLS configurations can return no error even when no row is deleted.
      // Double-check existence to avoid "it disappeared then came back" behavior.
      const verifyResult = await supabase
        .from('retreats')
        .select('*')
        .eq('id', retreatId)
        .maybeSingle();

      if (verifyResult.error) throw verifyResult.error;
      if (verifyResult.data) {
        throw new Error(
          `Nao foi possivel apagar o retiro "${retreatName}". Verifique as politicas de permissao (RLS) para DELETE em retreats.`
        );
      }

      setRetreats((currentRetreats) => currentRetreats.filter((item) => item.id !== retreatId));
      setRetreatToDelete(null);
      alert('Retiro apagado com sucesso.');
    } catch (error) {
      console.error('Error deleting retreat:', error);
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Erro ao apagar retiro. Tente novamente.';
      alert(message);
    } finally {
      setIsDeletingRetreat(false);
    }
  };

  const formatRetreatDate = (retreat: Retreat) => {
    const start = new Date(retreat.date).toLocaleDateString('pt-BR');
    const end = retreat.end_date ? new Date(retreat.end_date).toLocaleDateString('pt-BR') : null;
    return end && end !== start ? `${start} até ${end}` : start;
  };

  const formatUpdatedAt = (retreat: Retreat) => {
    const raw = retreat.updated_at ?? retreat.created_at;
    if (!raw) return '-';
    return new Date(raw).toLocaleString('pt-BR');
  };

  if (showForm) {
    return (
      <RetreatForm
        initialRetreat={editingRetreat}
        onSuccess={handleRetreatSaved}
        onCancel={() => {
          setShowForm(false);
          setEditingRetreat(null);
        }}
      />
    );
  }

  if (selectedRetreat) {
    return (
      <ParticipantsList
        retreat={selectedRetreat}
        onBack={() => setSelectedRetreat(null)}
      />
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative">
        <header className="bg-stone-900 border-b-4 border-amber-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={logoHomensDeFe}
                  alt="Logo Homens de Fé"
                  className="h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                />
                <div>
                  <h1 className="text-2xl font-bold text-amber-100 tracking-wider" style={{ fontFamily: 'serif' }}>
                    RETIROS HOMENS DE FÉ
                  </h1>
                  <p className="text-amber-400 text-sm">Bem-vindo, {profile?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={signOut}
                  className="flex items-center space-x-2 bg-stone-800 hover:bg-stone-700 text-amber-100 px-4 py-2 rounded border-2 border-amber-700 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>
              Retiros
            </h2>
            <button
              onClick={() => {
                setEditingRetreat(null);
                setShowForm(true);
              }}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold px-6 py-3 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all transform hover:scale-105 shadow-lg"
              style={{ fontFamily: 'serif' }}
            >
              <Plus className="w-5 h-5" />
              <span>NOVO RETIRO</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center text-amber-200 py-12">Carregando...</div>
          ) : retreats.length === 0 ? (
            <div className="bg-stone-800 border-2 border-amber-700 rounded-lg p-12 text-center">
              <Calendar className="w-16 h-16 text-amber-600 mx-auto mb-4" />
              <p className="text-amber-200 text-lg">Nenhum retiro cadastrado ainda.</p>
              <p className="text-amber-400 text-sm mt-2">Clique em "Novo Retiro" para começar.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {retreats.map((retreat) => (
                <div
                  key={retreat.id}
                  className="bg-stone-800 border-3 border-amber-700 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:scale-105"
                >
                  <div className="bg-gradient-to-r from-amber-700 to-amber-600 p-4">
                    <h3 className="text-xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>
                      {retreat.name}
                    </h3>
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="flex items-center text-amber-200">
                      <Calendar className="w-4 h-4 mr-2 text-amber-500" />
                      <span className="text-sm">
                        {formatRetreatDate(retreat)}
                      </span>
                    </div>
                    <div className="text-amber-300 text-sm">
                      <p className="font-semibold">📍 {retreat.location}</p>
                      <p className="text-xs text-amber-400 mt-1">{retreat.address}</p>
                      <p className="text-xs text-amber-500 mt-2">Última atualização: {formatUpdatedAt(retreat)}</p>
                    </div>
                    <div className="grid grid-cols-[42px_1fr_1fr_42px] gap-2 pt-4 border-t border-amber-700">
                      <button
                        onClick={() => {
                          setEditingRetreat(retreat);
                          setShowForm(true);
                        }}
                        className="h-11 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-amber-100 rounded border border-amber-700 transition-all"
                        title="Editar retiro"
                      >
                        <Pencil className="w-4 h-4 shrink-0" />
                      </button>
                      <button
                        onClick={() => copyShareLink(retreat.share_link)}
                        className="h-11 flex items-center justify-center gap-2 bg-stone-700 hover:bg-stone-600 text-amber-200 px-3 rounded border border-amber-700 transition-all text-sm"
                      >
                        <LinkIcon className="w-4 h-4 shrink-0" />
                        <span className="leading-none">Copiar Link</span>
                      </button>
                      <button
                        onClick={() => setSelectedRetreat(retreat)}
                        className="h-11 flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-amber-100 px-3 rounded border border-amber-600 transition-all text-sm font-bold"
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        <span className="leading-none">Inscritos</span>
                      </button>
                      <button
                        onClick={() => setRetreatToDelete(retreat)}
                        className="h-11 flex items-center justify-center bg-red-800 hover:bg-red-700 text-red-100 rounded border border-red-700 transition-all"
                        title="Apagar retiro"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {retreatToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border-4 border-red-700 rounded-lg shadow-2xl p-6">
            <h3 className="text-xl font-bold text-red-200 mb-3" style={{ fontFamily: 'serif' }}>
              Confirmar exclusão
            </h3>
            <p className="text-slate-200 mb-6">
              Tem certeza que deseja apagar o retiro <span className="font-bold">{retreatToDelete.name}</span>?
            </p>
            <p className="text-red-300 text-sm mb-6">Essa ação não pode ser desfeita.</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRetreatToDelete(null)}
                disabled={isDeletingRetreat}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-slate-100 px-4 py-2 rounded border border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteRetreat}
                disabled={isDeletingRetreat}
                className="flex-1 bg-red-800 hover:bg-red-700 text-red-100 px-4 py-2 rounded border border-red-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingRetreat ? 'Apagando...' : 'Apagar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
