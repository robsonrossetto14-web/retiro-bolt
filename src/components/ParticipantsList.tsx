import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Send, CheckCircle, AlertCircle, Trash2, Search, Copy, Users, Clock3, DollarSign } from 'lucide-react';
import ExcelJS from 'exceljs';
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
  const [searchTerm, setSearchTerm] = useState('');

  const compactText = (value?: string, maxLen = 180) => {
    if (!value) return '';
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen)}...`;
  };

  const formatWhatsAppStatus = (whatsapp: { sent: boolean; reason?: string; details?: string }) => {
    if (whatsapp.sent) return 'ok';
    if (!whatsapp.reason) return 'falhou';

    if (!whatsapp.details) return `falhou (${whatsapp.reason})`;

    return `falhou (${whatsapp.reason}) - ${compactText(whatsapp.details, 140)}`;
  };

  const formatEmailStatus = (result: { emailSent: boolean; error?: string; details?: string }) => {
    if (result.emailSent) return 'ok';
    const reason = result.error ? ` (${result.error})` : '';
    const details = result.details ? ` - ${compactText(result.details)}` : '';
    return `falhou${reason}${details}`;
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
      alert('Insira os dados/formas de pagamento.');
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
          `Email: ${formatEmailStatus(emailSent)}`,
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
          `Email: ${formatEmailStatus(emailSent)}`,
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

  const formatPhoneExport = (value: string | undefined): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return value;
  };

  const statusPriority = (s: Registration['payment_status']) =>
    s === 'paid' ? 3 : s === 'link_sent' ? 2 : 1;

  const deduplicateSmart = (list: Registration[]): Registration[] => {
    const byName = new Map<string, Registration[]>();
    for (const reg of list) {
      const key = (reg.full_name ?? '').trim().toLowerCase();
      if (!key) continue;
      const arr = byName.get(key) ?? [];
      arr.push(reg);
      byName.set(key, arr);
    }
    const result: Registration[] = [];
    for (const arr of byName.values()) {
      const best = arr.sort((a, b) => {
        const pa = statusPriority(a.payment_status);
        const pb = statusPriority(b.payment_status);
        if (pa !== pb) return pb - pa;
        return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
      })[0];
      result.push(best);
    }
    return result;
  };

  const sortByName = (list: Registration[]): Registration[] =>
    [...list].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR'));

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

  const statusLabel = (status: Registration['payment_status']) =>
    status === 'paid' ? 'Pago' : status === 'link_sent' ? 'Link Enviado' : 'Pendente';

  const buildRowData = (reg: Registration) => [
    reg.full_name,
    reg.email,
    formatPhoneExport(reg.phone),
    reg.date_of_birth ? new Date(reg.date_of_birth).toLocaleDateString('pt-BR') : '',
    reg.parish,
    hasHealthIssue(reg) ? 'Sim' : 'Não',
    healthIssueDetails(reg) || '',
    reg.shirt_size,
    reg.emergency_contact_name,
    formatPhoneExport(reg.emergency_contact_phone),
    statusLabel(reg.payment_status),
    new Date(reg.registered_at).toLocaleString('pt-BR'),
  ];

  const applyArial = (cell: ExcelJS.Cell) => {
    cell.font = { name: 'Arial', size: 11 };
  };

  const exportToExcel = async () => {
    const deduped = deduplicateSmart(registrations);
    const paid = sortByName(deduped.filter((r) => r.payment_status === 'paid'));
    const linkSent = sortByName(deduped.filter((r) => r.payment_status === 'link_sent'));
    const pending = sortByName(deduped.filter((r) => r.payment_status === 'pending'));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Retiro Bolt';

    const addSheet = (name: string, list: Registration[]) => {
      const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell) => { cell.font = { name: 'Arial', size: 11, bold: true }; });
      for (const reg of list) {
        const row = sheet.addRow(buildRowData(reg));
        row.eachCell((cell) => applyArial(cell));
      }
      const colCount = headers.length;
      const maxWidths = new Array<number>(colCount).fill(10);
      sheet.eachRow((row) => {
        row.eachCell((cell, colNumber) => {
          const idx = (colNumber as number) - 1;
          if (idx >= 0 && idx < colCount) {
            const len = String(cell.value ?? '').length;
            maxWidths[idx] = Math.max(maxWidths[idx], Math.min(len + 2, 60));
          }
        });
      });
      headers.forEach((h, i) => { maxWidths[i] = Math.max(maxWidths[i], h.length + 2); });
      for (let i = 0; i < colCount; i++) {
        sheet.getColumn(i + 1).width = maxWidths[i] ?? 18;
      }
    };

    addSheet('Pago', paid);
    addSheet('Link Enviado', linkSent);
    addSheet('Pendente', pending);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const linkEl = document.createElement('a');
    linkEl.href = url;
    linkEl.download = `inscritos_${retreat.name}_${Date.now()}.xlsx`;
    linkEl.style.visibility = 'hidden';
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
    URL.revokeObjectURL(url);
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

  const copyShareLink = () => {
    const fullUrl = `${window.location.origin}/inscricao/${retreat.share_link}`;
    navigator.clipboard.writeText(fullUrl);
    alert('Link de inscrição copiado!');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRegistrations = registrations.filter((item) => {
    if (!normalizedSearch) return true;
    const haystack = `${item.full_name} ${item.email} ${item.phone} ${item.parish}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const paidCount = registrations.filter((item) => item.payment_status === 'paid').length;
  const pendingCount = registrations.filter((item) => item.payment_status === 'pending').length;
  const totalRaised = paidCount * Number(retreat.price ?? 0);
  const maxSlotsLabel = retreat.max_slots ? `de ${retreat.max_slots} vagas` : 'vagas nao definidas';
  const shareLinkUrl = `${window.location.origin}/inscricao/${retreat.share_link}`;

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
          <div className="mb-6 rounded-xl border border-amber-700/70 bg-gradient-to-r from-amber-900/40 to-amber-800/30 p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-amber-300 font-semibold">Link de inscrição</p>
                <p className="text-xs text-amber-400">Compartilhe este link com os participantes</p>
              </div>
              <button
                onClick={copyShareLink}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-600 bg-amber-700 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-600 transition-all"
              >
                <Copy className="w-4 h-4" />
                Copiar link
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-amber-700/80 bg-stone-900/70 px-3 py-2 text-sm text-amber-200 break-all">
              {shareLinkUrl}
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-amber-700 bg-stone-900/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-400 uppercase">Total inscritos</p>
                <Users className="w-4 h-4 text-amber-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>{registrations.length}</p>
              <p className="text-xs text-amber-400 mt-1">{maxSlotsLabel}</p>
            </div>
            <div className="rounded-xl border border-green-700 bg-stone-900/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-300 uppercase">Pagos</p>
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-green-200" style={{ fontFamily: 'serif' }}>{paidCount}</p>
            </div>
            <div className="rounded-xl border border-amber-700 bg-stone-900/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-300 uppercase">Pendentes</p>
                <Clock3 className="w-4 h-4 text-amber-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-blue-700 bg-stone-900/80 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-blue-300 uppercase">Arrecadado</p>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-200" style={{ fontFamily: 'serif' }}>
                {totalRaised.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-amber-700 bg-stone-900/80 p-4">
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

          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-700 bg-stone-900/80 p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, telefone ou paróquia..."
                className="w-full pl-9 pr-3 py-2 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => void exportToExcel()}
              className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-700 px-4 py-2 text-sm font-bold text-green-100 hover:bg-green-600 transition-all"
              style={{ fontFamily: 'serif' }}
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>

          {loading ? (
            <div className="text-center text-amber-200 py-12">Carregando...</div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="bg-stone-800 border-2 border-amber-700 rounded-lg p-12 text-center">
              <p className="text-amber-200 text-lg">
                {registrations.length === 0 ? 'Nenhuma inscrição ainda.' : 'Nenhum participante encontrado na busca.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRegistrations.map((registration) => (
                <div
                  key={registration.id}
                  className="bg-stone-900/90 border border-amber-700 rounded-xl p-5 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-amber-100" style={{ fontFamily: 'serif' }}>
                        {registration.full_name}
                      </h3>
                      <p className="text-amber-300 text-sm">{registration.phone} • {registration.parish}</p>
                      <p className="text-amber-400 text-xs">{registration.email}</p>
                    </div>
                    {getStatusBadge(registration.payment_status)}
                  </div>

                  <div className="grid md:grid-cols-3 gap-x-6 gap-y-2 text-sm text-amber-200 mb-4">
                    <div><span className="text-amber-400 font-semibold">Camiseta:</span> {registration.shirt_size}</div>
                    <div><span className="text-amber-400 font-semibold">Emergência:</span> {registration.emergency_contact_name}</div>
                    <div><span className="text-amber-400 font-semibold">Tel. Emergência:</span> {registration.emergency_contact_phone}</div>
                    <div>
                      <span className="text-amber-400 font-semibold">Data Nasc.:</span>{' '}
                      {registration.date_of_birth ? new Date(registration.date_of_birth).toLocaleDateString('pt-BR') : '-'}
                    </div>
                    <div><span className="text-amber-400 font-semibold">Saúde:</span> {hasHealthIssue(registration) ? 'Sim' : 'Não'}</div>
                    <div><span className="text-amber-400 font-semibold">Cadastro:</span> {new Date(registration.registered_at).toLocaleDateString('pt-BR')}</div>
                  </div>

                  {hasHealthIssue(registration) && healthIssueDetails(registration) && (
                    <div className="mb-4 rounded-lg border border-amber-700 bg-stone-800 p-3">
                      <span className="text-amber-400 font-semibold text-sm">Detalhes do problema de saúde:</span>
                      <p className="text-amber-200 text-sm mt-1">{healthIssueDetails(registration)}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {registration.payment_status === 'pending' && (
                      <button
                        onClick={() => openPaymentModal(registration)}
                        className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-blue-100 px-4 py-2 rounded border border-blue-600 transition-all text-sm font-bold"
                      >
                        <Send className="w-4 h-4" />
                        <span>Enviar Formas de Pagamento</span>
                      </button>
                    )}
                    {registration.payment_status === 'link_sent' && (
                      <button
                        onClick={() => confirmPayment(registration)}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-green-100 px-4 py-2 rounded border border-green-600 transition-all text-sm font-bold"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Confirmar Pagamento</span>
                      </button>
                    )}
                    <button
                      onClick={() => deleteParticipant(registration)}
                      disabled={deletingParticipantId === registration.id}
                      className="flex items-center gap-2 bg-red-800 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-red-100 px-4 py-2 rounded border border-red-700 transition-all text-sm font-bold"
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
              placeholder="Cole aqui as instruções/formas de pagamento que irão no e-mail..."
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
