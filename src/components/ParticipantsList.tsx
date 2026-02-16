import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Send, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase, Retreat, Registration } from '../lib/supabase';
import { sendEmailNotification } from '../lib/notifications';

type ParticipantsListProps = {
  retreat: Retreat;
  onBack: () => void;
};

export default function ParticipantsList({ retreat, onBack }: ParticipantsListProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<Registration | null>(null);
  const [paymentLink, setPaymentLink] = useState('');
  const [whatsappGroup, setWhatsappGroup] = useState('');
  const [deletingParticipantId, setDeletingParticipantId] = useState<string | null>(null);
  const [savingDefaultPayment, setSavingDefaultPayment] = useState(false);

  const formatWhatsAppStatus = (whatsapp: { sent: boolean; reason?: string; details?: string }) => {
    if (whatsapp.sent) return 'ok';
    if (!whatsapp.reason) return 'falhou';

    if (!whatsapp.details) return `falhou (${whatsapp.reason})`;

    const compactDetails = whatsapp.details.replace(/\s+/g, ' ').trim();
    const shortDetails = compactDetails.length > 140 ? `${compactDetails.slice(0, 140)}...` : compactDetails;
    return `falhou (${whatsapp.reason}) - ${shortDetails}`;
  };

  const hasHealthIssue = (registration: Registration) => registration.has_health_issue;
  const healthIssueDetails = (registration: Registration) => registration.health_issue_details;

  const formatRetreatDate = (currentRetreat: Retreat) => {
    const start = new Date(currentRetreat.date).toLocaleDateString('pt-BR');
    const end = currentRetreat.end_date
      ? new Date(currentRetreat.end_date).toLocaleDateString('pt-BR')
      : null;
    return end && end !== start ? `${start} até ${end}` : start;
  };

  useEffect(() => {
    setWhatsappGroup(retreat.whatsapp_group_link ?? '');
  }, [retreat.id, retreat.whatsapp_group_link]);

  useEffect(() => {
    loadRegistrations();
  }, [retreat.id]);

  const saveRetreatWhatsAppLink = async (rawLink: string) => {
    const trimmedLink = rawLink.trim();
    if (!trimmedLink || trimmedLink === (retreat.whatsapp_group_link ?? '').trim()) {
      return true;
    }

    const { error } = await supabase
      .from('retreats')
      .update({ whatsapp_group_link: trimmedLink })
      .eq('id', retreat.id);

    if (error) {
      console.error('Error saving retreat WhatsApp group link:', error);
      return false;
    }

    return true;
  };

  const saveDefaultPaymentInstructions = async () => {
    const trimmedInstructions = paymentLink.trim();
    const currentDefault = (retreat.payment_instructions ?? '').trim();
    if (trimmedInstructions === currentDefault) {
      alert('As instrucoes ja estao iguais ao padrao do retiro.');
      return;
    }

    setSavingDefaultPayment(true);
    try {
      const { error } = await supabase
        .from('retreats')
        .update({ payment_instructions: trimmedInstructions || null })
        .eq('id', retreat.id);

      if (error) throw error;
      alert('Padrao de formas de pagamento atualizado para este retiro.');
    } catch (error) {
      console.error('Error saving default payment instructions:', error);
      alert('Nao foi possivel salvar o padrao de pagamento.');
    } finally {
      setSavingDefaultPayment(false);
    }
  };

  const loadRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('retreat_id', retreat.id)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentLink = async () => {
    if (!selectedParticipant) return;

    const trimmedPaymentLink = paymentLink.trim();
    if (!trimmedPaymentLink) {
      alert('Insira os dados/formas de pagamento via Sicoob/Sipag.');
      return;
    }

    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          payment_link: trimmedPaymentLink,
          payment_status: 'link_sent',
        })
        .eq('id', selectedParticipant.id);

      if (error) throw error;

      const emailSent = await sendEmailNotification({
        action: 'payment_link',
        to: selectedParticipant.email,
        phone: selectedParticipant.phone,
        participantName: selectedParticipant.full_name,
        retreatName: retreat.name,
        retreatDate: formatRetreatDate(retreat),
        location: retreat.location,
        paymentLink: trimmedPaymentLink,
      });

      alert(
        [
          'Formas de pagamento enviadas.',
          `Email: ${emailSent.emailSent ? 'ok' : 'falhou'}`,
          `WhatsApp: ${formatWhatsAppStatus(emailSent.whatsapp)}`,
        ].join('\n')
      );
      setSelectedParticipant(null);
      setPaymentLink('');
      loadRegistrations();
    } catch (error) {
      console.error('Error sending payment link:', error);
      alert('Erro ao enviar link de pagamento');
    }
  };

  const openPaymentModal = (registration: Registration) => {
    setSelectedParticipant(registration);
    setPaymentLink(retreat.payment_instructions ?? '');
  };

  const confirmPayment = async (registration: Registration) => {
    const trimmedWhatsappGroup = whatsappGroup.trim();
    if (!trimmedWhatsappGroup) {
      alert('Por favor, insira o link do grupo do WhatsApp primeiro');
      return;
    }

    try {
      const retreatLinkSaved = await saveRetreatWhatsAppLink(trimmedWhatsappGroup);
      if (!retreatLinkSaved) {
        alert('Nao foi possivel salvar o link do grupo para o retiro.');
        return;
      }

      const { error } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          payment_confirmed_at: new Date().toISOString(),
          whatsapp_group_link: trimmedWhatsappGroup,
        })
        .eq('id', registration.id);

      if (error) throw error;

      const emailSent = await sendEmailNotification({
        action: 'payment_confirmed',
        to: registration.email,
        phone: registration.phone,
        participantName: registration.full_name,
        retreatName: retreat.name,
        retreatDate: formatRetreatDate(retreat),
        location: retreat.location,
        whatsappGroupLink: trimmedWhatsappGroup,
      });

      alert(
        [
          'Pagamento confirmado.',
          `Email: ${emailSent.emailSent ? 'ok' : 'falhou'}`,
          `WhatsApp: ${formatWhatsAppStatus(emailSent.whatsapp)}`,
        ].join('\n')
      );
      loadRegistrations();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Erro ao confirmar pagamento');
    }
  };

  const deleteParticipant = async (registration: Registration) => {
    const confirmed = window.confirm(`Tem certeza que deseja apagar a inscrição de ${registration.full_name}?`);
    if (!confirmed) return;

    setDeletingParticipantId(registration.id);
    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', registration.id);

      if (error) throw error;

      setRegistrations((current) => current.filter((item) => item.id !== registration.id));
      if (selectedParticipant?.id === registration.id) {
        setSelectedParticipant(null);
        setPaymentLink('');
      }
    } catch (error) {
      console.error('Error deleting registration:', error);
      alert('Erro ao apagar participante');
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const exportToExcel = () => {
    const headers = [
      'Nome',
      'Email',
      'Telefone',
      'Data de Nascimento',
      'Paróquia',
      'Possui Problema de Saúde',
      'Detalhes do Problema de Saúde',
      'Tamanho da Camiseta',
      'Contato de Emergência',
      'Telefone de Emergência',
      'Status de Pagamento',
      'Data de Cadastro',
    ];

    const rows = registrations.map(reg => [
      reg.full_name,
      reg.email,
      reg.phone,
      reg.date_of_birth ? new Date(reg.date_of_birth).toLocaleDateString('pt-BR') : '',
      reg.parish,
      hasHealthIssue(reg) ? 'Sim' : 'Não',
      healthIssueDetails(reg) || '',
      reg.shirt_size,
      reg.emergency_contact_name,
      reg.emergency_contact_phone,
      reg.payment_status === 'paid' ? 'Pago' : reg.payment_status === 'link_sent' ? 'Link Enviado' : 'Pendente',
      new Date(reg.registered_at).toLocaleString('pt-BR'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inscritos_${retreat.name}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-900 text-green-200 border border-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Pago
          </span>
        );
      case 'link_sent':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-900 text-blue-200 border border-blue-700">
            <Send className="w-3 h-3 mr-1" />
            Link Enviado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-900 text-amber-200 border border-amber-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="app-bg min-h-screen">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative">
        <header className="bg-stone-900 border-b-4 border-amber-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-amber-100 tracking-wider" style={{ fontFamily: 'serif' }}>
                  {retreat.name}
                </h1>
                <p className="text-amber-300 text-sm">📅 {formatRetreatDate(retreat)}</p>
                <p className="text-amber-400 text-sm">Participantes Inscritos</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={exportToExcel}
                  className="flex items-center space-x-2 bg-green-700 hover:bg-green-600 text-green-100 px-4 py-2 rounded border-2 border-green-600 transition-all font-bold"
                  style={{ fontFamily: 'serif' }}
                >
                  <Download className="w-4 h-4" />
                  <span>EXPORTAR</span>
                </button>
                <button
                  onClick={onBack}
                  className="flex items-center space-x-2 bg-stone-800 hover:bg-stone-700 text-amber-100 px-4 py-2 rounded border-2 border-amber-700 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 bg-stone-900 border-2 border-amber-700 rounded-lg p-4">
            <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
              Link do Grupo do WhatsApp (necessário para confirmar pagamentos)
            </label>
            <input
              type="text"
              value={whatsappGroup}
              onChange={(e) => setWhatsappGroup(e.target.value)}
              onBlur={() => {
                void saveRetreatWhatsAppLink(whatsappGroup);
              }}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full px-4 py-2 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {loading ? (
            <div className="text-center text-amber-200 py-12">Carregando...</div>
          ) : registrations.length === 0 ? (
            <div className="bg-stone-800 border-2 border-amber-700 rounded-lg p-12 text-center">
              <p className="text-amber-200 text-lg">Nenhuma inscrição ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {registrations.map((registration) => (
                <div
                  key={registration.id}
                  className="bg-stone-900 border-2 border-amber-700 rounded-lg p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>
                        {registration.full_name}
                      </h3>
                      <p className="text-amber-300 text-sm">{registration.email}</p>
                    </div>
                    {getStatusBadge(registration.payment_status)}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm text-amber-200 mb-4">
                    <div>
                      <span className="text-amber-400 font-semibold">Telefone:</span> {registration.phone}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Paróquia:</span> {registration.parish}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Camiseta:</span> {registration.shirt_size}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Emergência:</span> {registration.emergency_contact_name}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Tel. Emergência:</span> {registration.emergency_contact_phone}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Problema de Saúde:</span>{' '}
                      {hasHealthIssue(registration) ? 'Sim' : 'Não'}
                    </div>
                    <div>
                      <span className="text-amber-400 font-semibold">Data de Nascimento:</span>{' '}
                      {registration.date_of_birth
                        ? new Date(registration.date_of_birth).toLocaleDateString('pt-BR')
                        : '-'}
                    </div>
                  </div>

                  {hasHealthIssue(registration) && healthIssueDetails(registration) && (
                    <div className="mb-4 p-3 bg-stone-800 border border-amber-700 rounded">
                      <span className="text-amber-400 font-semibold text-sm">
                        Detalhes do Problema de Saúde:
                      </span>
                      <p className="text-amber-200 text-sm mt-1">{healthIssueDetails(registration)}</p>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {registration.payment_status === 'pending' && (
                      <button
                        onClick={() => openPaymentModal(registration)}
                        className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-600 text-blue-100 px-4 py-2 rounded border border-blue-600 transition-all text-sm font-bold"
                      >
                        <Send className="w-4 h-4" />
                <span>Enviar Formas de Pagamento</span>
                      </button>
                    )}
                    {registration.payment_status === 'link_sent' && (
                      <button
                        onClick={() => confirmPayment(registration)}
                        className="flex items-center space-x-2 bg-green-700 hover:bg-green-600 text-green-100 px-4 py-2 rounded border border-green-600 transition-all text-sm font-bold"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Confirmar Pagamento</span>
                      </button>
                    )}
                    <button
                      onClick={() => deleteParticipant(registration)}
                      disabled={deletingParticipantId === registration.id}
                      className="flex items-center space-x-2 bg-red-800 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-red-100 px-4 py-2 rounded border border-red-700 transition-all text-sm font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{deletingParticipantId === registration.id ? 'Apagando...' : 'Apagar Participante'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {selectedParticipant && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-stone-900 border-4 border-amber-700 rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-amber-100 mb-4" style={{ fontFamily: 'serif' }}>
              Enviar Formas de Pagamento
            </h3>
            <p className="text-amber-200 mb-4">Para: {selectedParticipant.full_name}</p>
            <textarea
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              placeholder="Cole aqui as instruções/formas de pagamento via Sicoob/Sipag que irão no e-mail..."
              rows={6}
              className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 mb-4"
            />
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setSelectedParticipant(null);
                  setPaymentLink('');
                }}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-amber-100 px-4 py-2 rounded border-2 border-amber-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  void saveDefaultPaymentInstructions();
                }}
                disabled={savingDefaultPayment}
                className="flex-1 bg-blue-800 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-blue-100 px-4 py-2 rounded border border-blue-700 transition-all font-bold"
              >
                {savingDefaultPayment ? 'Salvando padrao...' : 'Atualizar no retiro'}
              </button>
              <button
                onClick={sendPaymentLink}
                className="flex-1 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-100 px-4 py-2 rounded border-2 border-amber-600 transition-all font-bold"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
