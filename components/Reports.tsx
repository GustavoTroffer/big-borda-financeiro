
import React, { useState, useEffect } from 'react';
import { getRecordByDate, getStaff, getRecords, deleteRecord } from '../services/storageService';
// Import StaffShift to fix the reference error on line 264
import { StaffMember, DailyCloseRecord, AuditEntry, StaffShift } from '../types';
import { generateFinancialSummary } from '../services/geminiService';
import { Printer, Wand2, Copy, Check, List, Calendar, Trash2, Search, History, AlertCircle, X, Bike, UserMinus, Receipt, StickyNote } from 'lucide-react';

interface ReportsProps {
  isVisible: boolean;
}

const Reports: React.FC<ReportsProps> = ({ isVisible }) => {
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

  const salesData = record ? getSales(record) : { ifood: 0, kcms: 0, sgv: 0 };
  const totalSales = salesData.ifood + salesData.kcms + salesData.sgv;
  
  // Informação de Saída (Não deduz do caixa conforme pedido)
  const ifoodMotoboyCost = record?.ifoodMotoboys?.totalCost || 0;
  const ifoodMotoboyCount = record?.ifoodMotoboys?.count || 0;
  
  // Saldo do dia é o total bruto das vendas
  const balance = totalSales;
  
  const totalStaffToPay = record ? record.payments.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalPendingToPay = record?.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalFiado = record?.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  
  const attendantName = record?.closedByStaffId 
    ? staffList.find(s => s.id === record.closedByStaffId)?.name 
    : 'Não informado';

  const filteredHistory = historyRecords.filter(r => 
      r.date.includes(searchTerm) || 
      staffList.find(s => s.id === r.closedByStaffId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto print:p-0 print:max-w-none">
      <div className="no-print flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setActiveTab('report')} className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'report' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}>
            <Calendar size={18} /> Relatório do Dia
        </button>
        <button onClick={() => setActiveTab('history')} className={`pb-3 px-4 font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'history' ? 'text-bigRed border-b-4 border-bigRed' : 'text-gray-400 hover:text-gray-600'}`}>
            <History size={18} /> Histórico de Fechamentos
        </button>
      </div>

      {activeTab === 'history' ? (
          <div className="no-print space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="relative w-full md:w-96">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
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
                                          <div className="flex justify-end gap-2">
                                              <button onClick={() => { setDate(r.date); setActiveTab('report'); }} className="p-2 text-gray-400 hover:text-bigYellow" title="Visualizar Relatório"><Printer size={18} /></button>
                                              <button onClick={() => handleDelete(r.date)} className="p-2 text-gray-400 hover:text-red-500" title="Excluir"><Trash2 size={18} /></button>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      ) : (
          <div className="space-y-8">
              <div className="no-print flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    {/* Campo de data desabilitado para alteração manual no relatório, conforme solicitado */}
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
                        {ifoodMotoboyCost > 0 && (
                            <div className="print-break-inside-avoid">
                                <h3 className="text-xs font-black text-white bg-gray-600 px-3 py-2 rounded-t-lg uppercase flex items-center gap-2"><Bike size={14}/> Informação: Motoboys iFood</h3>
                                <div className="p-4 border border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-600 uppercase">{ifoodMotoboyCount} Entregas realizadas</span>
                                    <span className="font-black font-mono text-lg">R$ {ifoodMotoboyCost.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        <div className="print-break-inside-avoid">
                            <h3 className="text-xs font-black text-white bg-bigRed px-3 py-2 rounded-t-lg uppercase">Valores a Pagar (Equipe Hoje)</h3>
                            <table className="w-full border border-gray-100">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                    <tr className="text-[10px] text-gray-500 font-black uppercase"><th className="px-4 py-3">Funcionário / PIX</th><th className="px-4 py-3 text-right">Valor</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {record.payments.map((p, idx) => {
                                        const staff = staffList.find(s => s.id === p.staffId);
                                        return (
                                            <tr key={idx}>
                                                <td className="px-4 py-3">
                                                  <div className="font-bold text-sm flex items-center gap-2">
                                                    {staff?.name || 'N/I'}{p.deliveryCount ? ` (${p.deliveryCount} entr.)` : ''}
                                                    <span className={`text-[8px] uppercase font-black px-1 py-0.5 rounded ${staff?.shift === StaffShift.DIURNO ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                                      {staff?.shift}
                                                    </span>
                                                  </div>
                                                  <div className="text-[10px] text-gray-400 font-mono">PIX: {staff?.pixKey || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-black font-mono">R$ {p.amount.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 font-black"><td className="px-4 py-3 text-right text-xs uppercase">Total Equipe a Pagar</td><td className="px-4 py-3 text-right font-mono text-bigRed text-lg">R$ {totalStaffToPay.toFixed(2)}</td></tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* EXIBIÇÃO DAS OBSERVAÇÕES NO RELATÓRIO */}
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
