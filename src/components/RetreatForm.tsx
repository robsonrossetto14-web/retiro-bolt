import React, { useState } from 'react';
import { Shield, ArrowLeft, Save } from 'lucide-react';
import { supabase, Retreat } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type RetreatFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  initialRetreat?: Retreat | null;
};

const buildInitialFormData = (retreat?: Retreat | null) => ({
  name: retreat?.name ?? '',
  date: retreat?.date ? String(retreat.date).slice(0, 10) : '',
  end_date: retreat?.end_date ? String(retreat.end_date).slice(0, 10) : retreat?.date ? String(retreat.date).slice(0, 10) : '',
  location: retreat?.location ?? '',
  address: retreat?.address ?? '',
  what_to_bring: retreat?.what_to_bring ?? '',
  payment_instructions: retreat?.payment_instructions ?? '',
  instagram_handle: retreat?.instagram_handle ?? '',
  shirt_sizes: retreat?.shirt_sizes ?? ['P', 'M', 'G', 'GG', 'XG'],
});

export default function RetreatForm({ onSuccess, onCancel, initialRetreat }: RetreatFormProps) {
  const { user } = useAuth();
  const isEditing = Boolean(initialRetreat?.id);
  const [formData, setFormData] = useState(buildInitialFormData(initialRetreat));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateShareLink = () => {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.end_date < formData.date) {
        throw new Error('A data de encerramento nao pode ser anterior a data de inicio.');
      }

      const basePayload = {
        name: formData.name,
        date: formData.date,
        location: formData.location,
        address: formData.address,
        what_to_bring: formData.what_to_bring,
        payment_instructions: formData.payment_instructions,
        instagram_handle: formData.instagram_handle,
        shirt_sizes: formData.shirt_sizes,
        share_link: generateShareLink(),
        created_by: user?.id,
      };

      if (isEditing && initialRetreat) {
        const updatePayload = {
          name: formData.name,
          date: formData.date,
          end_date: formData.end_date,
          location: formData.location,
          address: formData.address,
          what_to_bring: formData.what_to_bring,
          payment_instructions: formData.payment_instructions,
          instagram_handle: formData.instagram_handle,
          shirt_sizes: formData.shirt_sizes,
          updated_at: new Date().toISOString(),
        };

        let { error: updateError } = await supabase
          .from('retreats')
          .update(updatePayload)
          .eq('id', initialRetreat.id);

        const updateMessage = updateError?.message?.toLowerCase() ?? '';
        if (updateError && (updateMessage.includes('end_date') || updateMessage.includes('updated_at'))) {
          const fallbackUpdate = await supabase
            .from('retreats')
            .update({
              name: formData.name,
              date: formData.date,
              end_date: formData.end_date,
              location: formData.location,
              address: formData.address,
              what_to_bring: formData.what_to_bring,
              payment_instructions: formData.payment_instructions,
              instagram_handle: formData.instagram_handle,
              shirt_sizes: formData.shirt_sizes,
            })
            .eq('id', initialRetreat.id);
          updateError = fallbackUpdate.error;

          const fallbackMessage = updateError?.message?.toLowerCase() ?? '';
          if (updateError && fallbackMessage.includes('end_date')) {
            const legacyFallbackUpdate = await supabase
              .from('retreats')
              .update({
                name: formData.name,
                date: formData.date,
                location: formData.location,
                address: formData.address,
                what_to_bring: formData.what_to_bring,
                payment_instructions: formData.payment_instructions,
                instagram_handle: formData.instagram_handle,
                shirt_sizes: formData.shirt_sizes,
              })
              .eq('id', initialRetreat.id);
            updateError = legacyFallbackUpdate.error;
          }
        }

        if (updateError) throw updateError;
      } else {
        const payloadWithEndDate = {
          ...basePayload,
          end_date: formData.end_date,
        };

        let { error: insertError } = await supabase.from('retreats').insert(payloadWithEndDate);

        // Backward compatibility: if the remote DB was not migrated yet,
        // retry without end_date so retreat creation still works.
        if (insertError?.message?.toLowerCase().includes('end_date')) {
          const fallbackResult = await supabase.from('retreats').insert(basePayload);
          insertError = fallbackResult.error;
          if (!insertError) {
            setError(
              'Retiro criado, mas seu banco ainda nao tem o campo de encerramento. Rode a migration de end_date.'
            );
            onSuccess();
            return;
          }
        }

        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(isEditing ? 'Erro ao atualizar retiro' : 'Erro ao criar retiro');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg min-h-screen">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative">
        <header className="bg-stone-900 border-b-4 border-amber-700 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
            <div className="flex items-center space-x-3">
              <Shield className="w-10 h-10 text-amber-500" />
              <h1 className="text-2xl font-bold text-amber-100 tracking-wider" style={{ fontFamily: 'serif' }}>
                {isEditing ? 'EDITAR RETIRO' : 'NOVO RETIRO'}
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
          <div className="bg-stone-900 border-4 border-amber-700 rounded-lg shadow-2xl">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Nome do Retiro *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Data de Encerramento *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    min={formData.date || undefined}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Local *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Endereço Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    O que levar
                  </label>
                  <textarea
                    value={formData.what_to_bring}
                    onChange={(e) => setFormData({ ...formData, what_to_bring: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Ex: Roupa de cama, toalha, Bíblia, caderno..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Dados / Formas de pagamento (Sicoob/Sipag)
                  </label>
                  <textarea
                    value={formData.payment_instructions}
                    onChange={(e) => setFormData({ ...formData, payment_instructions: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Ex: Pagamento via Sicoob/Sipag, valor, vencimento, dados do pagador e instruções."
                  />
                </div>

                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Instagram do Retiro
                  </label>
                  <input
                    type="text"
                    value={formData.instagram_handle}
                    onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    placeholder="@retirodosguerreiros"
                  />
                </div>

                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Tamanhos de Camiseta
                  </label>
                  <input
                    type="text"
                    value={formData.shirt_sizes.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      shirt_sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    placeholder="P, M, G, GG, XG"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-900/50 border-2 border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="flex space-x-4 pt-6 border-t border-amber-700">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 flex items-center justify-center space-x-2 bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold px-6 py-3 rounded border-2 border-amber-700 transition-all"
                  style={{ fontFamily: 'serif' }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>VOLTAR</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold px-6 py-3 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                  style={{ fontFamily: 'serif' }}
                >
                  <Save className="w-5 h-5" />
                  <span>{loading ? 'SALVANDO...' : isEditing ? 'SALVAR ALTERAÇÕES' : 'CRIAR RETIRO'}</span>
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
