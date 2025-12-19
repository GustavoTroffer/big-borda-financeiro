import React, { useState, useEffect } from 'react';
import { getRecordByDate, getStaff, getRecords, deleteRecord } from '../services/storageService';
import { StaffMember, DailyCloseRecord } from '../types';
import { generateFinancialSummary } from '../services/geminiService';
import { Printer, Wand2, Copy, Check, List, Calendar, Trash2, Pencil, Search, History, AlertCircle } from 'lucide-react';

interface ReportsProps {
  isVisible: boolean;
  onEditRecord?: (date: string) => void;
}

const Reports: React.FC<ReportsProps> = ({ isVisible, onEditRecord }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [record, setRecord] = useState<DailyCloseRecord | undefined>(undefined);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Tabs: 'report' or 'history'
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report');
  
  // History States
  const [historyRecords, setHistoryRecords] = useState<DailyCloseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Update data when date changes OR when the view becomes visible
  useEffect(() => {
    if (isVisible) {
      setRecord(getRecordByDate(date));
      setStaffList(getStaff());
      setHistoryRecords(getRecords());
      setSummary('');
      setCopied(false);
    }
  }, [date, isVisible, activeTab]);

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateAi = async () => {
    if (!record) return;
    setLoadingAi(true);
    setCopied(false);
    const text = await generateFinancialSummary(record, staffList);
    setSummary(text);
    setLoadingAi(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleDelete = (dateToDelete: string) => {
      if (window.confirm(`Tem certeza que deseja EXCLUIR permanentemente o fechamento do dia ${dateToDelete.split('-').reverse().join('/')}?`)) {
          deleteRecord(dateToDelete);
          setHistoryRecords(getRecords());
          if (date === dateToDelete) setRecord(undefined);
      }
  };

  // Safe accessors for new fields (backward compatibility)
  const getSales = (r: DailyCloseRecord) => ({
      ifood: r.sales.ifood || 0,
      kcms: r.sales.kcms || (r.sales as any).app2 || 0,
      sgv: r.sales.sgv || (r.sales as any).app3 || 0,
  });

  const salesData = record ? getSales(record) : { ifood: 0, kcms: 0, sgv: 0 };
  const totalSales = salesData.ifood + salesData.kcms + salesData.sgv;
  const totalPayments = record ? record.payments.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalDebts = record && record.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalPending = record && record.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const ifoodMotoboyCost = record?.ifoodMotoboys?.totalCost || 0;
  const ifoodMotoboyCount = record?.ifoodMotoboys?.count || 0;
  const totalExpenses = totalPayments + ifoodMotoboyCost;
  const balance = totalSales - totalExpenses;
  
  const attendantName = record?.closedByStaffId 
    ? staffList.find(s => s.id === record.closedByStaffId)?.name 
    : 'Não informado';

  const filteredHistory = historyRecords.filter(r => 
      r.date.includes(searchTerm) || 
      staffList.find(s => s.id === r.closedByStaffId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0 print:max-w-none">
      
      {/* Tabs Header */}
      <div className="no-print flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button 
            onClick={() => setActiveTab('report')}
            className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'report' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <Calendar size={18} />
            Relatório do Dia
        </button>
        <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'history' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <History size={18} />
            Histórico de Fechamentos
        </button>
      </div>

      {activeTab === 'history' ? (
          /* HISTORY VIEW */
          <div className="no-print space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="relative w-full md:w-96">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Buscar por data ou responsável..." 
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                      {filteredHistory.length} Registros Encontrados
                  </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-gray-100 dark:border-gray-700">
                          <tr>
                              <th className="px-6 py-4">Data</th>
                              <th className="px-6 py-4">Responsável</th>
                              <th className="px-6 py-4 text-right">Saldo Final</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                          {filteredHistory.map(r => {
                              const sData = getSales(r);
                              const tS = sData.ifood + sData.kcms + sData.sgv;
                              const tE = r.payments.reduce((acc, curr) => acc + curr.amount, 0) + (r.ifoodMotoboys?.totalCost || 0);
                              const bal = tS - tE;
                              const resp = staffList.find(s => s.id === r.closedByStaffId)?.name || 'Não inf.';
                              const isEdited = r.auditLog && r.auditLog.length > 1;

                              return (
                                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                      <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-100">{r.date.split('-').reverse().join('/')}</td>
                                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 uppercase">{resp}</td>
                                      <td className="px-6 py-4 text-right font-mono font-black text-gray-900 dark:text-white">R$ {bal.toFixed(2)}</td>
                                      <td className="px-6 py-4 text-center">
                                          {isEdited ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full border border-blue-100 dark:border-blue-800">
                                                  <History size={10} /> EDITADO
                                              </span>
                                          ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-full border border-green-100 dark:border-green-800">
                                                  FECHADO
                                              </span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button 
                                                onClick={() => { setDate(r.date); setActiveTab('report'); }}
                                                className="p-2 text-gray-400 hover:text-bigYellow hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                                                title="Visualizar Detalhes"
                                              >
                                                  <Printer size={18} />
                                              </button>
                                              <button 
                                                onClick={() => onEditRecord?.(r.date)}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                title="Alterar Dados"
                                              >
                                                  <Pencil size={18} />
                                              </button>
                                              <button 
                                                onClick={() => handleDelete(r.date)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                title="Excluir Registro"
                                              >
                                                  <Trash2 size={18} />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
                  {filteredHistory.length === 0 && (
                      <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                          <AlertCircle size={48} className="opacity-10" />
                          <p>Nenhum registro encontrado para os critérios de busca.</p>
                      </div>
                  )}
              </div>
          </div>
      ) : (
          /* REPORT VIEW */
          <div className="space-y-8">
              {/* Controls - Hidden on Print */}
              <div className="no-print flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <label className="font-bold text-gray-700 dark:text-gray-300">Selecione a Data:</label>
                    <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="p-2 border border-bigYellow/50 bg-bigYellow/10 dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bigYellow outline-none text-gray-800 dark:text-gray-100 font-bold"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={handleGenerateAi}
                        className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 shadow transition-all font-bold"
                    >
                        <Wand2 size={18} />
                        {loadingAi ? 'Gerando...' : 'Resumo IA'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex-1 bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 shadow transition-all font-bold"
                    >
                        <Printer size={18} />
                        Imprimir
                    </button>
                </div>
              </div>

              {/* AI Summary Section */}
              {summary && (
                <div className="no-print mb-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                    <h3 className="font-black text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2 uppercase text-xs tracking-widest">
                        <Wand2 size={16} /> Resumo Gerado p/ WhatsApp
                    </h3>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-4 rounded-xl border border-purple-100 dark:border-purple-800 mb-4 shadow-inner">
                        {summary}
                    </pre>
                    <button 
                        onClick={copyToClipboard}
                        className={`w-full py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 font-black text-lg transition-all transform hover:scale-[1.01] active:scale-95
                          ${copied ? 'bg-green-700 text-white' : 'bg-green-600 text-white'}`}
                    >
                        {copied ? <Check size={24} /> : <Copy size={24} />}
                        {copied ? 'COPIADO COM SUCESSO!' : 'COPIAR PARA WHATSAPP'}
                    </button>
                </div>
              )}

              {/* Printable Area */}
              {!record ? (
                  <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-dashed border-gray-100 dark:border-gray-700">
                      <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400">Nenhum fechamento registrado para este dia.</p>
                  </div>
              ) : (
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg print:shadow-none print:p-0 border-t-8 border-bigRed transition-colors duration-300" id="printable-area">
                    <div className="flex justify-between items-start mb-8 border-b dark:border-gray-700 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-bigRed uppercase tracking-tighter">Big Borda Gourmet</h1>
                            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestão Financeira e Fechamento de Caixa</p>
                            <div className="mt-4 flex flex-col gap-1">
                                <p className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase">
                                  Responsável: <span className="text-bigRed dark:text-red-400">{attendantName}</span>
                                </p>
                                {record.auditLog && record.auditLog.length > 1 && (
                                    <p className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
                                        <AlertCircle size={10} /> ESTE REGISTRO POSSUI ALTERAÇÕES NO HISTÓRICO
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black text-gray-900 dark:text-white">{date.split('-').reverse().join('/')}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">Documento Original</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                        <div className="print-break-inside-avoid">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Entradas (Vendas)</h3>
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    <tr>
                                        <td className="py-2 text-gray-600 dark:text-gray-400 font-bold">iFood</td>
                                        <td className="py-2 font-mono text-right font-black text-gray-800 dark:text-gray-200">R$ {salesData.ifood.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-gray-600 dark:text-gray-400 font-bold">KCMS</td>
                                        <td className="py-2 font-mono text-right font-black text-gray-800 dark:text-gray-200">R$ {salesData.kcms.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-gray-600 dark:text-gray-400 font-bold">SGV</td>
                                        <td className="py-2 font-mono text-right font-black text-gray-800 dark:text-gray-200">R$ {salesData.sgv.toFixed(2)}</td>
                                    </tr>
                                    <tr className="bg-bigYellow/5 dark:bg-bigYellow/10">
                                        <td className="py-3 font-black text-gray-800 dark:text-white pl-2 text-xs uppercase">TOTAL VENDAS</td>
                                        <td className="py-3 font-mono text-right font-black text-bigYellow pr-2 text-lg">R$ {totalSales.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="print-break-inside-avoid">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Resumo de Saldo</h3>
                             <table className="w-full text-left">
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    <tr>
                                        <td className="py-2 text-gray-600 dark:text-gray-400 font-bold">Total Vendas</td>
                                        <td className="py-2 font-mono text-right font-black text-bigYellow">R$ {totalSales.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-gray-600 dark:text-gray-400 font-bold">Pagamentos Efetuados</td>
                                        <td className="py-2 font-mono text-right font-black text-bigRed">- R$ {totalExpenses.toFixed(2)}</td>
                                    </tr>
                                     <tr className="bg-gray-100 dark:bg-gray-700/50">
                                        <td className="py-4 font-black text-gray-900 dark:text-white pl-3 text-xs uppercase">SALDO FINAL LÍQUIDO</td>
                                        <td className="py-4 font-mono text-right font-black text-gray-950 dark:text-white pr-3 text-xl">R$ {balance.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            {record.notes && (
                                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">Observações:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{record.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detalhamento Sections */}
                    <div className="space-y-10">
                        {/* Payments Detailed */}
                        <div className="print-break-inside-avoid">
                            <h3 className="text-xs font-black text-white bg-bigRed px-3 py-2 rounded-t-lg uppercase tracking-widest">Detalhamento de Saídas (Caixa)</h3>
                            <table className="w-full text-left border-collapse border border-gray-100 dark:border-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">Beneficiário / PIX</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">Função</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {record.payments.map((p, idx) => {
                                        const staff = staffList.find(s => s.id === p.staffId);
                                        const deliveryText = p.deliveryCount ? ` (${p.deliveryCount} entr.)` : '';
                                        return (
                                            <tr key={idx}>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{staff?.name || 'Desconhecido'}{deliveryText}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">PIX: {staff?.pixKey || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-xs uppercase text-gray-500 font-bold">{staff?.role}</td>
                                                <td className="px-4 py-3 text-right font-black font-mono text-gray-800 dark:text-gray-200">R$ {p.amount.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                    {ifoodMotoboyCount > 0 && (
                                        <tr className="bg-red-50/50 dark:bg-red-900/10">
                                            <td className="px-4 py-3 font-bold text-sm">Motoboys iFood ({ifoodMotoboyCount} boys)</td>
                                            <td className="px-4 py-3 text-xs uppercase text-gray-400 font-bold italic">Entrega Avulsa</td>
                                            <td className="px-4 py-3 text-right font-black font-mono">R$ {ifoodMotoboyCost.toFixed(2)}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 font-black">
                                        <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-widest text-gray-500">Total Pago Hoje</td>
                                        <td className="px-4 py-3 text-right font-mono text-bigRed text-lg">R$ {totalExpenses.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Debts & Pendencies - Half Width Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             {totalDebts > 0 && (
                                <div className="print-break-inside-avoid">
                                    <h3 className="text-xs font-black text-gray-800 bg-bigYellow px-3 py-2 rounded-t-lg uppercase tracking-widest">Fiado / Receber (Informativo)</h3>
                                    <table className="w-full text-left border border-gray-100 dark:border-gray-700">
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {record.debts.map((d, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 text-sm font-bold">{d.name}</td>
                                                    <td className="px-3 py-2 text-right font-black font-mono">R$ {d.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             )}
                             {totalPending > 0 && (
                                <div className="print-break-inside-avoid">
                                    <h3 className="text-xs font-black text-white bg-gray-800 px-3 py-2 rounded-t-lg uppercase tracking-widest">Pendências Futuras (A Pagar)</h3>
                                    <table className="w-full text-left border border-gray-100 dark:border-gray-700">
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {record.pendingPayables?.map((p, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 text-sm font-bold">
                                                        {p.name}
                                                        <span className="block text-[9px] text-gray-400 font-normal">Data ref: {p.date?.split('-').reverse().join('/')}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-black font-mono">R$ {p.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             )}
                        </div>
                    </div>
                    
                    <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-700 text-center flex flex-col items-center gap-2">
                        <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.2em]">Big Borda Gourmet - Sistema de Gestão Financeira</p>
                        <p className="text-[8px] text-gray-200">ID do Documento: {record.id} | Criado em: {new Date(record.createdAt || '').toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Reports;