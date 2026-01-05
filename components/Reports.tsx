
import React, { useState, useEffect } from 'react';
import { getRecordByDate, getStaff, getRecords, deleteRecord } from '../services/storageService';
// Import StaffShift to fix the reference error
import { StaffMember, DailyCloseRecord, AuditEntry, StaffShift } from '../types';
import { generateFinancialSummary } from '../services/geminiService';
import { Printer, Wand2, Copy, Check, List, Calendar, Trash2, Search, History, AlertCircle, X, Bike, UserMinus, Receipt, StickyNote, BarChart3, Filter, ChevronDown, Pencil, ExternalLink, Banknote } from 'lucide-react';

interface ReportsProps {
  isVisible: boolean;
  onEditRecord?: (date: string) => void;
}

type PeriodType = 'custom' | 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual';

interface AggregatedSummary {
  sales: { ifood: number; kcms: number; sgv: number };
  totalSales: number;
  totalPayments: number;
  totalPending: number;
  totalFiado: number;
  ifoodMotoboyCost: number;
  recordCount: number;
  startDate: string;
  endDate: string;
}

const Reports: React.FC<ReportsProps> = ({ isVisible, onEditRecord }) => {
  // Garantir fuso local
  const getTodayLocalDate = () => {
    return new Date().toLocaleDateString('en-CA');
  };

  const [date, setDate] = useState<string>(getTodayLocalDate());
  const [record, setRecord] = useState<DailyCloseRecord | undefined>(undefined);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report');
  const [historyRecords, setHistoryRecords] = useState<DailyCloseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [specificDateSearch, setSpecificDateSearch] = useState('');

  // Consolidation States
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [aggregatedData, setAggregatedData] = useState<AggregatedSummary | null>(null);

  useEffect(() => {
    if (isVisible) {
      setRecord(getRecordByDate(date));
      setStaffList(getStaff());
      setHistoryRecords(getRecords());
      setSummary('');
      setCopied(false);
    }
  }, [date, isVisible, activeTab]);

  const handlePrint = () => window.print();

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
      if (window.confirm(`Tem certeza que deseja EXCLUIR o fechamento do dia ${dateToDelete.split('-').reverse().join('/')}?`)) {
          deleteRecord(dateToDelete);
          setHistoryRecords(getRecords());
          if (date === dateToDelete) setRecord(undefined);
      }
  };

  const getSales = (r: DailyCloseRecord) => ({
      ifood: r.sales.ifood || 0,
      kcms: r.sales.kcms || (r.sales as any).app2 || 0,
      sgv: r.sales.sgv || (r.sales as any).app3 || 0,
  });

  // Consolidation Logic
  const handleConsolidate = () => {
    if (historyRecords.length === 0) return;

    const today = new Date();
    let startDate = new Date();

    switch (periodType) {
      case 'weekly':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(today.getMonth() - 1);
        break;
      case 'bimonthly':
        startDate.setMonth(today.getMonth() - 2);
        break;
      case 'quarterly':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case 'semiannual':
        startDate.setMonth(today.getMonth() - 6);
        break;
      case 'annual':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
    }

    const filtered = historyRecords.filter(r => {
      const recordDate = new Date(r.date + 'T12:00:00');
      return recordDate >= startDate && recordDate <= today;
    });

    if (filtered.length === 0) {
      alert("Nenhum registro encontrado no período selecionado.");
      return;
    }

    const summary: AggregatedSummary = {
      sales: { ifood: 0, kcms: 0, sgv: 0 },
      totalSales: 0,
      totalPayments: 0,
      totalPending: 0,
      totalFiado: 0,
      ifoodMotoboyCost: 0,
      recordCount: filtered.length,
      startDate: startDate.toLocaleDateString('en-CA'),
      endDate: today.toLocaleDateString('en-CA')
    };

    filtered.forEach(r => {
      const s = getSales(r);
      summary.sales.ifood += s.ifood;
      summary.sales.kcms += s.kcms;
      summary.sales.sgv += s.sgv;
      summary.totalSales += (s.ifood + s.kcms + s.sgv);
      summary.totalPayments += r.payments.reduce((acc, curr) => acc + curr.amount, 0);
      summary.totalPending += r.pendingPayables?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      summary.totalFiado += r.debts.reduce((acc, curr) => acc + curr.amount, 0);
      summary.ifoodMotoboyCost += r.ifoodMotoboys?.totalCost || 0;
    });

    setAggregatedData(summary);
    setIsConsolidating(true);
  };

  const handleOpenSpecificDate = () => {
    if (specificDateSearch && onEditRecord) {
        onEditRecord(specificDateSearch);
    }
  };

  const salesData = record ? getSales(record) : { ifood: 0, kcms: 0, sgv: 0 };
  const totalSales = salesData.ifood + salesData.kcms + salesData.sgv;
  const balance = totalSales;
  const totalStaffToPay = record ? record.payments.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalPendingToPay = record?.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalFiado = record?.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const attendantName = record?.closedByStaffId ? staffList.find(s => s.id === record.closedByStaffId)?.name : 'Não informado';

  const filteredHistory = historyRecords.filter(r => 
      r.date.includes(searchTerm) || 
      staffList.find(s => s.id === r.closedByStaffId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0 print:max-w-none">
      <div className="no-print flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => { setActiveTab('report'); setIsConsolidating(false); }} className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'report' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}>
            <Calendar size={18} /> Relatório do Dia
        </button>
        <button onClick={() => setActiveTab('history')} className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'history' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}>
            <History size={18} /> Histórico de Fechamentos
        </button>
      </div>

      {activeTab === 'history' ? (
          <div className="no-print space-y-6">
              {/* Consolidation Tool */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                              <BarChart3 size={24} />
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-800 dark:text-white leading-none">Concatenar Períodos</h3>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1">Análise Consolidada</p>
                          </div>
                      </div>
                      
                      <div className="flex-1 flex gap-2 w-full">
                          <select 
                            className="flex-1 p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
                            value={periodType}
                            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                          >
                              <option value="weekly">Semanal (7 dias)</option>
                              <option value="monthly">Mensal (30 dias)</option>
                              <option value="bimonthly">Bimestral (60 dias)</option>
                              <option value="quarterly">Trimestral (90 dias)</option>
                              <option value="semiannual">Semestral (180 dias)</option>
                              <option value="annual">Anual (365 dias)</option>
                          </select>
                          <button 
                            onClick={handleConsolidate}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
                          >
                            <Filter size={18} /> Gerar Consolidado
                          </button>
                      </div>
                  </div>

                  {isConsolidating && aggregatedData && (
                      <div className="mt-6 p-6 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl animate-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center mb-6">
                              <h4 className="font-black text-purple-700 dark:text-purple-400 uppercase text-xs tracking-widest">Resultado do Período ({aggregatedData.recordCount} dias)</h4>
                              <button onClick={() => setIsConsolidating(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/20">
                                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendas Brutas</span>
                                  <span className="text-xl font-black text-purple-600">R$ {aggregatedData.totalSales.toFixed(2)}</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/20">
                                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Equipe</span>
                                  <span className="text-xl font-black text-bigRed">R$ {aggregatedData.totalPayments.toFixed(2)}</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/20">
                                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Pendências</span>
                                  <span className="text-xl font-black text-orange-500">R$ {aggregatedData.totalPending.toFixed(2)}</span>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/20">
                                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Fiado</span>
                                  <span className="text-xl font-black text-bigYellow">R$ {aggregatedData.totalFiado.toFixed(2)}</span>
                              </div>
                          </div>

                          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="space-y-2">
                                  <h5 className="text-[10px] font-black text-gray-500 uppercase">Detalhamento Vendas</h5>
                                  <div className="text-xs space-y-1">
                                      <div className="flex justify-between"><span>iFood</span><span className="font-bold">R$ {aggregatedData.sales.ifood.toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>KCMS</span><span className="font-bold">R$ {aggregatedData.sales.kcms.toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>SGV</span><span className="font-bold">R$ {aggregatedData.sales.sgv.toFixed(2)}</span></div>
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <h5 className="text-[10px] font-black text-gray-500 uppercase">Médias por Dia</h5>
                                  <div className="text-xs space-y-1">
                                      <div className="flex justify-between"><span>Venda Média</span><span className="font-bold">R$ {(aggregatedData.totalSales / aggregatedData.recordCount).toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>Pagamento Médio</span><span className="font-bold">R$ {(aggregatedData.totalPayments / aggregatedData.recordCount).toFixed(2)}</span></div>
                                  </div>
                              </div>
                              <div className="flex flex-col justify-end">
                                  <button onClick={handlePrint} className="w-full bg-gray-800 dark:bg-gray-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Printer size={16} /> Imprimir Consolidado</button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="relative w-full md:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="text" placeholder="Filtrar histórico..." className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-bigYellow" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full md:w-auto">
                      <span className="text-[10px] uppercase font-black text-gray-400 px-2">Abrir data:</span>
                      <input 
                        type="date" 
                        className="bg-transparent text-sm font-bold outline-none"
                        value={specificDateSearch}
                        onChange={(e) => setSpecificDateSearch(e.target.value)}
                      />
                      <button 
                        onClick={handleOpenSpecificDate}
                        disabled={!specificDateSearch}
                        className="bg-bigRed text-white p-2 rounded-lg disabled:opacity-30 hover:bg-red-800 transition-colors"
                        title="Abrir página de fechamento deste dia"
                      >
                        <ExternalLink size={16} />
                      </button>
                  </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-gray-100 dark:border-gray-700">
                          <tr>
                              <th className="px-6 py-4">Data</th>
                              <th className="px-6 py-4">Responsável</th>
                              <th className="px-6 py-4 text-right">Total Vendas</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                          {filteredHistory.map(r => {
                              const sD = getSales(r);
                              const tS = sD.ifood + sD.kcms + sD.sgv;
                              const resp = staffList.find(s => s.id === r.closedByStaffId)?.name || 'N/I';
                              return (
                                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                      <td className="px-6 py-4 font-bold">{r.date.split('-').reverse().join('/')}</td>
                                      <td className="px-6 py-4 text-xs uppercase">{resp}</td>
                                      <td className="px-6 py-4 text-right font-mono font-black">R$ {tS.toFixed(2)}</td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-1">
                                              <button onClick={() => { if(onEditRecord) onEditRecord(r.date); }} className="p-2 text-gray-400 hover:text-blue-500" title="Editar Fechamento"><Pencil size={18} /></button>
                                              <button onClick={() => { setDate(r.date); setActiveTab('report'); }} className="p-2 text-gray-400 hover:text-bigYellow" title="Visualizar Relatório"><Printer size={18} /></button>
                                              <button onClick={() => handleDelete(r.date)} className="p-2 text-gray-400 hover:text-red-500" title="Excluir"><Trash2 size={18} /></button>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
                  {filteredHistory.length === 0 && (
                      <div className="py-20 text-center text-gray-400 italic text-sm">Nenhum registro encontrado.</div>
                  )}
              </div>
          </div>
      ) : (
          /* Report Tab Content */
          <div className="space-y-8">
              <div className="no-print flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 opacity-80">
                      <Calendar size={18} className="text-bigRed" />
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        {date.split('-').reverse().join('/')}
                      </span>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleGenerateAi} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 font-bold shadow transition-all"><Wand2 size={18} /> {loadingAi ? 'Gerando...' : 'Resumo IA'}</button>
                    <button onClick={handlePrint} className="flex-1 bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 font-bold shadow transition-all"><Printer size={18} /> Imprimir</button>
                </div>
              </div>

              {summary && (
                <div className="no-print mb-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded-xl p-6">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-4 rounded-xl border border-purple-100 mb-4 shadow-inner">{summary}</pre>
                    <button onClick={copyToClipboard} className={`w-full py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 font-black text-lg transition-all ${copied ? 'bg-green-700' : 'bg-green-600 text-white'}`}>{copied ? <Check size={24} /> : <Copy size={24} />} {copied ? 'COPIADO!' : 'COPIAR PARA WHATSAPP'}</button>
                </div>
              )}

              {!record ? (
                  <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-100">
                      <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400">Para visualizar um relatório, selecione um dia no <button onClick={() => setActiveTab('history')} className="text-bigRed font-bold underline">Histórico</button>.</p>
                  </div>
              ) : (
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border-t-8 border-bigRed" id="printable-area">
                    <div className="flex justify-between items-start mb-8 border-b dark:border-gray-700 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-bigRed uppercase">Big Borda Gourmet</h1>
                            <p className="text-sm font-black text-gray-800 dark:text-gray-200 mt-4 uppercase">Responsável: <span className="text-bigRed">{attendantName}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black">{date.split('-').reverse().join('/')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                        <div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b pb-2">Entradas (Vendas)</h3>
                            <table className="w-full">
                                <tbody className="divide-y">
                                    <tr><td className="py-2 font-bold">iFood</td><td className="py-2 font-mono text-right">R$ {salesData.ifood.toFixed(2)}</td></tr>
                                    <tr><td className="py-2 font-bold">KCMS</td><td className="py-2 font-mono text-right">R$ {salesData.kcms.toFixed(2)}</td></tr>
                                    <tr><td className="py-2 font-bold">SGV</td><td className="py-2 font-mono text-right">R$ {salesData.sgv.toFixed(2)}</td></tr>
                                    <tr className="bg-bigYellow/5 font-black"><td className="py-3 pl-2 text-xs">TOTAL VENDAS</td><td className="py-3 text-right text-bigYellow pr-2 text-lg">R$ {totalSales.toFixed(2)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 border-b pb-2">Saldo em Caixa</h3>
                             <table className="w-full">
                                <tbody className="divide-y">
                                    <tr><td className="py-2 font-bold">Vendas Brutas</td><td className="py-2 font-mono text-right">R$ {totalSales.toFixed(2)}</td></tr>
                                    <tr className="bg-gray-100 dark:bg-gray-700/50 font-black"><td className="py-4 pl-3 text-xs">SALDO FINAL EM CAIXA</td><td className="py-4 text-right pr-3 text-xl">R$ {balance.toFixed(2)}</td></tr>
                                </tbody>
                            </table>
                            <p className="text-[9px] text-gray-400 mt-4 italic">* O saldo acima reflete as vendas totais do dia. Custos de motoboys e equipe são processados separadamente.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                         {totalFiado > 0 && (
                            <div className="print-break-inside-avoid">
                                <h3 className="text-xs font-black text-white bg-bigYellow px-3 py-2 rounded-t-lg uppercase flex items-center gap-2"><UserMinus size={14}/> Fiado (A Receber)</h3>
                                <table className="w-full border border-gray-100">
                                    <tbody className="divide-y">
                                        {record.debts.map((d, i) => (
                                            <tr key={i}><td className="px-4 py-2 text-sm font-bold">{d.name}</td><td className="px-4 py-2 text-right font-mono text-sm">R$ {d.amount.toFixed(2)}</td></tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-black text-sm text-black"><td className="px-4 py-2 text-right">Total Fiado</td><td className="px-4 py-2 text-right">R$ {totalFiado.toFixed(2)}</td></tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                        {totalPendingToPay > 0 && (
                            <div className="print-break-inside-avoid">
                                <h3 className="text-xs font-black text-white bg-red-800 px-3 py-2 rounded-t-lg uppercase flex items-center gap-2"><Receipt size={14}/> Pendências (A Pagar)</h3>
                                <table className="w-full border border-gray-100">
                                    <tbody className="divide-y">
                                        {record.pendingPayables?.map((p, i) => (
                                            <tr key={i}><td className="px-4 py-2 text-sm"><div className="font-bold">{p.name}</div><div className="text-[10px] text-gray-400">Ref: {p.date?.split('-').reverse().join('/')}</div></td><td className="px-4 py-2 text-right font-mono text-sm">R$ {p.amount.toFixed(2)}</td></tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-black text-sm text-black"><td className="px-4 py-2 text-right">Total Pendências</td><td className="px-4 py-2 text-right">R$ {totalPendingToPay.toFixed(2)}</td></tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="space-y-10">
                        {record.ifoodMotoboys?.totalCost && record.ifoodMotoboys.totalCost > 0 && (
                            <div className="print-break-inside-avoid">
                                <h3 className="text-xs font-black text-white bg-gray-600 px-3 py-2 rounded-t-lg uppercase flex items-center gap-2"><Bike size={14}/> Informação: Motoboys iFood</h3>
                                <div className="p-4 border border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-600 uppercase">{record.ifoodMotoboys.count} Entregas realizadas</span>
                                    <span className="font-black font-mono text-lg">R$ {record.ifoodMotoboys.totalCost.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        <div className="print-break-inside-avoid">
                            <h3 className="text-xs font-black text-white bg-bigRed px-3 py-2 rounded-t-lg uppercase">Valores a Pagar (Equipe Hoje)</h3>
                            <table className="w-full border border-gray-100">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr className="text-[10px] text-gray-500 font-black uppercase">
                                        <th className="px-4 py-3 text-left">Funcionário / PIX</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {record.payments.map((p, idx) => {
                                        const staff = staffList.find(s => s.id === p.staffId);
                                        return (
                                            <tr key={idx} className={p.isPaid ? 'bg-green-50/30' : ''}>
                                                <td className="px-4 py-3">
                                                  <div className="font-bold text-sm flex items-center gap-2">
                                                    {staff?.name || 'N/I'}{p.deliveryCount ? ` (${p.deliveryCount} entr.)` : ''}
                                                    <span className={`text-[8px] uppercase font-black px-1 py-0.5 rounded ${staff?.shift === StaffShift.DIURNO ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                                      {staff?.shift}
                                                    </span>
                                                  </div>
                                                  <div className="text-[10px] text-gray-400 font-mono">PIX: {staff?.pixKey || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {p.isPaid ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-widest">
                                                            <Check size={10} /> Pago
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 uppercase tracking-widest">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-black font-mono">R$ {p.amount.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 font-black"><td colSpan={2} className="px-4 py-3 text-right text-xs uppercase">Total Equipe a Pagar</td><td className="px-4 py-3 text-right font-mono text-bigRed text-lg">R$ {totalStaffToPay.toFixed(2)}</td></tr>
                                </tfoot>
                            </table>
                        </div>

                        {record.notes && (
                            <div className="print-break-inside-avoid">
                                <h3 className="text-xs font-black text-white bg-gray-800 px-3 py-2 rounded-t-lg uppercase flex items-center gap-2"><StickyNote size={14}/> Observações do Dia</h3>
                                <div className="p-4 border border-gray-100 bg-gray-50/50 text-sm text-gray-700 whitespace-pre-wrap italic">
                                    {record.notes}
                                </div>
                            </div>
                        )}
                    </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Reports;
