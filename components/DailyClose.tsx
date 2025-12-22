
import React, { useState, useEffect, useRef } from 'react';
import { DailyCloseRecord, StaffMember, DailySales, DebtItem, PendingItem, StaffRole, StaffShift, AuditEntry, WeeklySchedule, DayOfWeek } from '../types';
import { getStaff, getRecordByDate, upsertRecord, generateId, getWeeklySchedule, getRecords } from '../services/storageService';
import { Save, Calendar, DollarSign, Users, UserMinus, Plus, Trash2, UserPlus, MessageSquare, Clock, CheckCircle2, UserCheck, Bike, Check, X, ArrowRight, Search, AlertCircle, Receipt, UserRound, StickyNote, Filter, ListChecks } from 'lucide-react';

interface DailyCloseProps {
  isVisible: boolean;
}

const DailyClose: React.FC<DailyCloseProps> = ({ isVisible }) => {
  // Garantir que a data seja 'hoje' no fuso local (YYYY-MM-DD)
  const getTodayLocalDate = () => {
    return new Date().toLocaleDateString('en-CA');
  };

  const [date, setDate] = useState<string>(getTodayLocalDate());
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  
  // Form States
  const [sales, setSales] = useState<DailySales>({ ifood: 0, kcms: 0, sgv: 0 });
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>({}); 
  const [activeStaffIds, setActiveStaffIds] = useState<string[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]); 
  const [pendingPayables, setPendingPayables] = useState<PendingItem[]>([]); 
  const [notes, setNotes] = useState('');
  const [closingStaffId, setClosingStaffId] = useState<string>(''); 
  const [savedMessage, setSavedMessage] = useState('');

  // UI States - Modal selection
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isClosingStaffModalOpen, setIsClosingStaffModalOpen] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [closingSearchTerm, setClosingSearchTerm] = useState('');
  const [modalDayFilter, setModalDayFilter] = useState<DayOfWeek | 'todos'>('todos');
  const [selectedInModal, setSelectedInModal] = useState<string[]>([]);
  
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');

  // iFood Motoboys State
  const [ifoodRides, setIfoodRides] = useState<number[]>([]);
  const [currentRideCost, setCurrentRideCost] = useState('');

  // New Debt Input State
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');

  // New Pending Payable Input State
  const [newPendingName, setNewPendingName] = useState('');
  const [newPendingAmount, setNewPendingAmount] = useState('');
  const [newPendingDate, setNewPendingDate] = useState<string>('');

  // Efeito 1: Sincroniza apenas listas externas (Funcionários e Escala) ao abrir a aba
  useEffect(() => {
    if (isVisible) {
      setStaffList(getStaff());
      setWeeklySchedule(getWeeklySchedule());
    }
  }, [isVisible]);

  // Efeito 2: Carrega os dados do dia selecionado. 
  useEffect(() => {
    const record = getRecordByDate(date);
    if (record) {
      setSales({
        ifood: record.sales.ifood || 0,
        kcms: record.sales.kcms || (record.sales as any).app2 || 0,
        sgv: record.sales.sgv || (record.sales as any).app3 || 0,
      });
      setNotes(record.notes || '');
      setClosingStaffId(record.closedByStaffId || '');
      
      const paymentMap: Record<string, number> = {};
      const deliveryMap: Record<string, number> = {};
      const activeIds: string[] = [];
      
      record.payments.forEach(p => {
        paymentMap[p.staffId] = p.amount;
        if (p.deliveryCount) {
            deliveryMap[p.staffId] = p.deliveryCount;
        }
        activeIds.push(p.staffId);
      });
      
      setPayments(paymentMap);
      setDeliveryCounts(deliveryMap);
      setActiveStaffIds(activeIds);
      setDebts(record.debts || []);
      setPendingPayables(record.pendingPayables || []);

      if (record.ifoodMotoboys?.rides) {
        setIfoodRides(record.ifoodMotoboys.rides);
      } else if (record.ifoodMotoboys?.totalCost && record.ifoodMotoboys.totalCost > 0) {
        setIfoodRides([record.ifoodMotoboys.totalCost]);
      } else {
        setIfoodRides([]);
      }
    } else {
      setSales({ ifood: 0, kcms: 0, sgv: 0 });
      setPayments({});
      setDeliveryCounts({});
      setActiveStaffIds([]);
      setDebts([]);
      setPendingPayables([]);
      setIfoodRides([]);
      setNotes('');
      setClosingStaffId('');
    }
    setSavedMessage('');
    setNewPendingDate(date);
    setCurrentRideCost('');
    
    // Auto-set modal day filter based on current date
    const days: DayOfWeek[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dateObj = new Date(date + 'T12:00:00');
    setModalDayFilter(days[dateObj.getDay()]);

  }, [date]);

  const handleAddIfoodRide = () => {
    const amount = parseFloat(currentRideCost.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    setIfoodRides(prev => [...prev, amount]);
    setCurrentRideCost('');
  };

  const removeIfoodRide = (index: number) => {
    setIfoodRides(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectPendingRecipient = (name: string) => {
    setNewPendingName(name);
    setIsPendingModalOpen(false);
    setPendingSearchTerm('');
  };

  const handleBlurCurrency = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    if (!value) return;
    const cleanValue = value.replace(',', '.');
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      setter(num.toFixed(2));
    }
  };

  const handleSalesChange = (key: keyof DailySales, value: string) => {
    const num = parseFloat(value) || 0;
    setSales(prev => ({ ...prev, [key]: num }));
  };

  const handlePaymentChange = (staffId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setPayments(prev => ({ ...prev, [staffId]: num }));
  };

  const handleDeliveryCountChange = (staffId: string, value: string) => {
    const num = parseInt(value) || 0;
    setDeliveryCounts(prev => ({ ...prev, [staffId]: num }));
  };

  // Funções de Seleção Múltipla
  const toggleModalSelection = (staffId: string) => {
    setSelectedInModal(prev => 
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const handleAddSelectedToDaily = () => {
    if (selectedInModal.length > 0) {
      setActiveStaffIds(prev => {
        const next = [...prev];
        selectedInModal.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
    setIsStaffModalOpen(false);
    setStaffSearchTerm('');
    setSelectedInModal([]);
  };

  const handleBulkAddFromSchedule = () => {
    if (modalDayFilter === 'todos') return;
    
    const scheduledIds = weeklySchedule?.[modalDayFilter] || [];
    const idsToAdd = scheduledIds.filter(id => !activeStaffIds.includes(id));
    
    if (idsToAdd.length > 0) {
      setActiveStaffIds(prev => [...prev, ...idsToAdd]);
    }
    
    setIsStaffModalOpen(false);
    setStaffSearchTerm('');
  };

  const handleRemoveStaffFromDaily = (staffId: string) => {
    setActiveStaffIds(prev => prev.filter(id => id !== staffId));
    setPayments(prev => {
        const next = { ...prev };
        delete next[staffId];
        return next;
    });
    setDeliveryCounts(prev => {
        const next = { ...prev };
        delete next[staffId];
        return next;
    });
  };

  const handleAddDebt = () => {
    if (!newDebtName || !newDebtAmount) return;
    const amount = parseFloat(newDebtAmount);
    if (isNaN(amount) || amount <= 0) return;
    setDebts(prev => [...prev, { id: generateId(), name: newDebtName, amount }]);
    setNewDebtName('');
    setNewDebtAmount('');
  };

  const deleteDebt = (id: string, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setDebts(prevDebts => prevDebts.filter(d => d.id !== id));
  };

  const handleAddPending = () => {
    if (!newPendingName || !newPendingAmount) return;
    const amount = parseFloat(newPendingAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPendingPayables(prev => [...prev, { id: generateId(), name: newPendingName, amount, date: newPendingDate || date }]);
    setNewPendingName('');
    setNewPendingAmount('');
    setNewPendingDate(date);
  };

  const deletePending = (id: string, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setPendingPayables(prev => prev.filter(p => p.id !== id));
  };

  const performFinalSave = () => {
    if (!closingStaffId) {
      alert("⚠️ ATENÇÃO: Por favor, selecione quem está realizando o fechamento no campo 'Quem está fechando?'.");
      return;
    }

    const existingRecord = getRecordByDate(date);
    const now = new Date().toISOString();
    
    const paymentList = activeStaffIds.map(staffId => ({
        staffId,
        amount: payments[staffId] || 0,
        deliveryCount: deliveryCounts[staffId] || 0
    })).filter(p => p.amount > 0);

    const newRecord: DailyCloseRecord = {
      id: date, date, sales, payments: paymentList, debts, pendingPayables,
      ifoodMotoboys: { count: ifoodRides.length, totalCost: ifoodRides.reduce((acc, curr) => acc + curr, 0), rides: ifoodRides },
      notes, closedByStaffId: closingStaffId, isClosed: true,
      createdAt: existingRecord?.createdAt || now, updatedAt: now
    };

    upsertRecord(newRecord);
    setSavedMessage('Salvo!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const totalSales = sales.ifood + sales.kcms + sales.sgv;
  const ifoodMotoboyTotalCost = ifoodRides.reduce((acc, curr) => acc + curr, 0);

  const cardClass = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300";
  const sectionHeaderClass = "px-6 py-4 border-b border-gray-50 dark:border-gray-700 flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50";
  const sectionTitleClass = "font-bold text-gray-800 dark:text-white text-lg";

  // Filter logic for staff modal
  const availableStaffForPayments = staffList
    .filter(s => !activeStaffIds.includes(s.id))
    .filter(s => s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()))
    .filter(s => {
        if (modalDayFilter === 'todos') return true;
        return weeklySchedule?.[modalDayFilter]?.includes(s.id);
    });

  const filteredStaffForPending = staffList
    .filter(s => s.name.toLowerCase().includes(pendingSearchTerm.toLowerCase()));

  const closingAttendants = staffList
    .filter(s => s.role === StaffRole.ATENDENTE)
    .filter(s => s.name.toLowerCase().includes(closingSearchTerm.toLowerCase()));

  const selectedClosingStaff = staffList.find(s => s.id === closingStaffId);

  const modalDays: { key: DayOfWeek | 'todos'; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'segunda', label: 'Seg' },
    { key: 'terca', label: 'Ter' },
    { key: 'quarta', label: 'Qua' },
    { key: 'quinta', label: 'Qui' },
    { key: 'sexta', label: 'Sex' },
    { key: 'sabado', label: 'Sáb' },
    { key: 'domingo', label: 'Dom' },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-32 md:pb-12 px-4 md:px-0">
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-bigRed dark:text-red-400 tracking-tight">Fechamento de Caixa</h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm">Controle diário financeiro</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsClosingStaffModalOpen(true)}
              className={`flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-2.5 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-600 transition-all text-left w-full md:w-64 ${!closingStaffId ? 'border-red-300 animate-pulse' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <UserCheck className={`w-5 h-5 ml-1 ${!closingStaffId ? 'text-red-500' : 'text-bigRed dark:text-red-400'}`} />
              <div className="flex flex-col flex-1 truncate">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest leading-none mb-1">Responsável</span>
                <span className={`font-bold text-sm ${!closingStaffId ? 'text-gray-400 italic' : 'text-gray-800 dark:text-white'}`}>
                  {selectedClosingStaff ? selectedClosingStaff.name : "Selecionar Atendente"}
                </span>
              </div>
              <ArrowRight size={14} className="text-gray-300" />
            </button>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 w-full md:w-auto opacity-80 cursor-default">
              <Calendar className="w-5 h-5 text-bigRed dark:text-red-400" />
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {date.split('-').reverse().join('/')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Coluna Esquerda */}
        <div className="space-y-6">
          <div className={`${cardClass} border-t-4 border-t-bigYellow`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigYellow/10 dark:bg-bigYellow/20 rounded text-bigYellow"><DollarSign size={18} /></div>
              <h3 className={sectionTitleClass}>Entradas (Vendas)</h3>
            </div>
            <div className="p-6 space-y-5">
              {[{ label: 'iFood', key: 'ifood' as keyof DailySales, value: sales.ifood }, { label: 'KCMS', key: 'kcms' as keyof DailySales, value: sales.kcms }, { label: 'SGV', key: 'sgv' as keyof DailySales, value: sales.sgv }].map((item) => (
                <div key={item.label}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 ml-1">{item.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-bigYellow/70 font-sans text-sm font-bold">R$</span>
                    <input type="number" step="0.01" className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-100 text-sm focus:ring-2 focus:ring-bigYellow outline-none transition-all placeholder-gray-400" value={item.value || ''} onChange={(e) => handleSalesChange(item.key, e.target.value)} onWheel={(e) => e.currentTarget.blur()} placeholder="0,00" />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-bigYellow/5 dark:bg-bigYellow/10 px-6 py-4 flex justify-between items-center border-t border-bigYellow/10 dark:border-bigYellow/20">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Vendas</span>
              <div className="text-xl font-bold text-bigYellow bg-white dark:bg-gray-700 px-3 py-1 rounded shadow-sm border border-bigYellow/20">R$ {totalSales.toFixed(2)}</div>
            </div>
          </div>

          <div className={`${cardClass} border-t-4 border-t-bigRed`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigRed/10 dark:bg-bigRed/20 rounded text-bigRed"><Bike size={18} /></div>
              <div>
                  <h3 className={sectionTitleClass}>Motoboy iFood</h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Entregas Avulsas</p>
              </div>
            </div>
            <div className="p-6">
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-bigRed/50 text-sm">R$</span>
                        <input type="number" step="0.01" placeholder="Valor da Corrida" className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-bigRed outline-none" value={currentRideCost} onChange={(e) => setCurrentRideCost(e.target.value)} onBlur={(e) => handleBlurCurrency(setCurrentRideCost, e.target.value)} />
                    </div>
                    <button onClick={handleAddIfoodRide} className="bg-bigRed text-white p-2 px-4 rounded-lg hover:bg-red-800 transition-colors shadow-sm flex items-center gap-1 font-bold">
                        <Plus size={18} /> Lançar
                    </button>
                </div>
                
                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                    {ifoodRides.length === 0 ? (
                        <p className="text-center py-4 text-gray-400 text-xs italic">Nenhuma entrega avulsa lançada.</p>
                    ) : ifoodRides.map((ride, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600">
                            <span className="text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-tighter">Corrida #{idx + 1}</span>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-bigRed text-sm">R$ {ride.toFixed(2)}</span>
                                <button onClick={() => removeIfoodRide(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5"><X size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-bigRed/5 dark:bg-bigRed/10 px-6 py-4 flex justify-between items-center border-t border-bigRed/10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Avulsos</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{ifoodRides.length} Entregas</span>
                </div>
                <div className="text-lg font-bold text-bigRed">R$ {ifoodMotoboyTotalCost.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-6">
          <div className={`${cardClass} border-t-4 border-t-bigRed`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigRed/10 dark:bg-bigRed/20 rounded text-bigRed"><Users size={18} /></div>
              <h3 className={sectionTitleClass}>Pagamentos (Equipe)</h3>
            </div>
            <div className="p-6">
                <button onClick={() => setIsStaffModalOpen(true)} className="w-full py-3 bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-bigRed transition-all flex items-center justify-center gap-2 group mb-6"><Plus /> Adicionar Funcionário</button>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {activeStaffIds.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Nenhum pagamento hoje.</div>) : activeStaffIds.map(staffId => {
                        const staff = staffList.find(s => s.id === staffId);
                        if (!staff) return null;
                        return (
                            <div key={staff.id} className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-between gap-3 group">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate flex items-center gap-2">
                                    {staff.name}
                                    <span className={`text-[8px] px-1 py-0.5 rounded-full font-black uppercase tracking-widest ${staff.shift === StaffShift.DIURNO ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                      {staff.shift}
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{staff.role}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {staff.role === StaffRole.MOTOBOY && (
                                        <div className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-800/50 p-1 rounded border border-gray-100 dark:border-gray-600">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Entregas</span>
                                            <input type="number" className="w-12 text-center text-sm font-bold text-gray-700 dark:text-gray-200 bg-transparent outline-none border-b border-gray-300 p-0 h-6" value={deliveryCounts[staff.id] || ''} onChange={(e) => handleDeliveryCountChange(staff.id, e.target.value)} placeholder="0" />
                                        </div>
                                    )}
                                    <div className="relative w-28">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-bigRed/70 text-xs font-bold">R$</span>
                                        <input type="number" step="0.01" className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100 font-medium text-right outline-none" value={payments[staff.id] || ''} onChange={(e) => handlePaymentChange(staff.id, e.target.value)} />
                                    </div>
                                    <button onClick={() => handleRemoveStaffFromDaily(staff.id)} className="text-gray-300 hover:text-red-500 p-1.5 transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>

          <div className={`${cardClass} border-t-4 border-t-bigYellow`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigYellow/10 dark:bg-bigYellow/20 rounded text-bigYellow"><UserMinus size={18} /></div>
              <div><h3 className={sectionTitleClass}>Fiado</h3><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Receber Futuramente</p></div>
            </div>
            <div className="p-6">
               <div className="flex gap-2 mb-6">
                  <input type="text" placeholder="Nome" className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-bigYellow outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-800 dark:text-gray-100" value={newDebtName} onChange={(e) => setNewDebtName(e.target.value)} />
                  <div className="relative w-28">
                      <input type="number" step="0.01" placeholder="0,00" className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-right focus:ring-2 focus:ring-bigYellow outline-none font-medium" value={newDebtAmount} onChange={(e) => setNewDebtAmount(e.target.value)} onBlur={(e) => handleBlurCurrency(setNewDebtAmount, e.target.value)} />
                  </div>
                  <button onClick={handleAddDebt} className="bg-bigYellow text-white p-2 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"><Plus size={18} /></button>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                {debts.map(debt => (
                    <div key={debt.id} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all">
                        <span className="text-gray-700 dark:text-gray-200 font-medium text-sm pl-1">{debt.name}</span>
                        <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-bigYellow text-sm mr-2">R$ {debt.amount.toFixed(2)}</span>
                            <button onClick={(e) => deleteDebt(debt.id, e)} className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${cardClass} border-t-4 border-t-bigRed`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigRed/10 dark:bg-bigRed/20 rounded text-bigRed"><Receipt size={18} /></div>
              <div><h3 className={sectionTitleClass}>Pendências</h3><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Gastos com Equipe</p></div>
            </div>
            <div className="p-6">
                <button onClick={() => setIsPendingModalOpen(true)} className="w-full mb-4 py-2 bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-400 hover:text-bigRed transition-colors flex items-center justify-center gap-2">
                    <UserPlus size={14} /> Selecionar Funcionário
                </button>
                <div className="space-y-4 mb-6">
                    <div className="flex gap-2">
                        <input type="text" placeholder="Nome" className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-bigRed outline-none text-gray-800 dark:text-gray-100" value={newPendingName} onChange={(e) => setNewPendingName(e.target.value)} />
                        <div className="relative w-28">
                            <input type="number" step="0.01" placeholder="0,00" className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-right focus:ring-2 focus:ring-bigRed outline-none font-medium" value={newPendingAmount} onChange={(e) => setNewPendingAmount(e.target.value)} onBlur={(e) => handleBlurCurrency(setNewPendingAmount, e.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3">
                            <span className="text-[10px] uppercase font-bold text-gray-400">Data Ref:</span>
                            <input type="date" className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none p-2 w-full" value={newPendingDate} onChange={(e) => setNewPendingDate(e.target.value)} />
                        </div>
                        <button onClick={handleAddPending} className="bg-bigRed text-white p-2 px-6 rounded-lg hover:bg-red-800 transition-colors shadow-sm font-bold flex items-center gap-2"><Plus size={18} /> Lançar</button>
                    </div>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                    {pendingPayables.length === 0 ? (
                        <p className="text-center py-4 text-gray-400 text-xs italic">Nenhuma pendência hoje.</p>
                    ) : pendingPayables.map(pending => (
                        <div key={pending.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600">
                            <div className="flex flex-col">
                                <span className="text-gray-700 dark:text-gray-200 font-bold text-sm pl-1">{pending.name}</span>
                                {pending.date && <span className="text-[9px] text-bigRed pl-1 uppercase font-black tracking-widest">Referente: {pending.date.split('-').reverse().join('/')}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-bigRed text-sm mr-2">R$ {pending.amount.toFixed(2)}</span>
                                <button onClick={(e) => deletePending(pending.id, e)} className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOVO CAMPO: OBSERVAÇÕES */}
      <div className={`${cardClass} border-t-4 border-t-gray-400 mb-6`}>
        <div className={sectionHeaderClass}>
          <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500"><StickyNote size={18} /></div>
          <h3 className={sectionTitleClass}>Observações do Dia</h3>
        </div>
        <div className="p-6">
          <textarea
            placeholder="Digite aqui observações importantes, ocorrências ou detalhes sobre o fechamento..."
            className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-gray-400 outline-none transition-all resize-none text-gray-700 dark:text-gray-100"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 flex justify-end items-center gap-3 z-40 md:static md:bg-transparent md:border-none md:p-0 md:mt-8">
        {savedMessage && <div className="mr-auto hidden md:flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg"><CheckCircle2 size={18} /> {savedMessage}</div>}
        
        <button 
            onClick={performFinalSave} 
            className="bg-gradient-to-r from-bigRed to-red-800 text-white px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg flex-1 md:flex-none justify-center"
        >
            <Save size={20} /> Salvar Fechamento
        </button>
      </div>

      {/* MODAL: SELECIONAR RESPONSÁVEL (ATENDENTES) */}
      {isClosingStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-bigRed/10 rounded-lg"><UserRound className="text-bigRed" size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black text-gray-800 dark:text-white leading-none">Quem está fechando?</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">Apenas Atendentes</p>
                        </div>
                    </div>
                    <button onClick={() => { setIsClosingStaffModalOpen(false); setClosingSearchTerm(''); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar atendente..." 
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-bigRed"
                      value={closingSearchTerm}
                      onChange={(e) => setClosingSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    {closingAttendants.length === 0 ? (
                      <div className="text-center py-12">
                          <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 text-sm italic">Nenhum atendente encontrado.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                          {closingAttendants.map(staff => (
                              <button 
                                key={staff.id} 
                                onClick={() => { setClosingStaffId(staff.id); setIsClosingStaffModalOpen(false); setClosingSearchTerm(''); }} 
                                className={`text-left p-4 rounded-xl border transition-all flex justify-between items-center group ${closingStaffId === staff.id ? 'bg-bigRed/5 border-bigRed ring-1 ring-bigRed' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-bigRed'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${closingStaffId === staff.id ? 'bg-bigRed text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                          {staff.name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className={`font-bold ${closingStaffId === staff.id ? 'text-bigRed' : 'text-gray-800 dark:text-gray-100'}`}>{staff.name}</span>
                                  </div>
                                  {closingStaffId === staff.id ? <Check size={18} className="text-bigRed" /> : <ArrowRight size={16} className="text-gray-200 group-hover:text-bigRed" />}
                              </button>
                          ))}
                      </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* MODAL: SELECIONAR FUNCIONÁRIOS (MULTIPLE SELECTION) */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Users size={24} className="text-bigRed" /> Adicionar à Equipe</h3>
                    <button onClick={() => { setIsStaffModalOpen(false); setStaffSearchTerm(''); setSelectedInModal([]); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                </div>

                {/* Day Filter Tabs */}
                <div className="bg-gray-100 dark:bg-gray-900 px-2 flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-700">
                    {modalDays.map(day => (
                        <button
                            key={day.key}
                            onClick={() => setModalDayFilter(day.key)}
                            className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap relative
                                ${modalDayFilter === day.key 
                                    ? 'text-bigRed border-b-2 border-bigRed' 
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                }
                            `}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar por nome..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-bigRed"
                      value={staffSearchTerm}
                      onChange={(e) => setStaffSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    {modalDayFilter !== 'todos' && availableStaffForPayments.length > 0 && (
                      <button 
                          onClick={handleBulkAddFromSchedule}
                          className="flex-1 py-2 bg-bigRed/10 hover:bg-bigRed/20 text-bigRed text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all"
                      >
                          <ListChecks size={14} /> Selecionar Todos de {modalDays.find(d => d.key === modalDayFilter)?.label}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30 dark:bg-gray-900/20">
                    {availableStaffForPayments.length === 0 ? (
                      <div className="text-center py-12">
                          <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 text-sm italic">
                            {modalDayFilter === 'todos' 
                                ? 'Nenhum funcionário encontrado.' 
                                : `Nenhum funcionário escalado para ${modalDays.find(d => d.key === modalDayFilter)?.label} disponível.`}
                          </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableStaffForPayments.map(staff => {
                              const isSelected = selectedInModal.includes(staff.id);
                              return (
                                <button 
                                  key={staff.id} 
                                  onClick={() => toggleModalSelection(staff.id)} 
                                  className={`text-left p-4 rounded-xl border transition-all group flex justify-between items-center shadow-sm relative overflow-hidden
                                      ${isSelected ? 'bg-bigRed/5 border-bigRed ring-1 ring-bigRed' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-bigRed'}
                                  `}
                                >
                                    <div>
                                        <p className={`font-bold transition-colors flex items-center gap-2 ${isSelected ? 'text-bigRed' : 'text-gray-800 dark:text-gray-100'}`}>
                                          {staff.name}
                                          <span className={`text-[8px] px-1 py-0.5 rounded-full font-black uppercase tracking-widest ${staff.shift === StaffShift.DIURNO ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {staff.shift}
                                          </span>
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{staff.role}</p>
                                    </div>
                                    <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-bigRed text-white' : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-bigRed/10 text-gray-300 group-hover:text-bigRed'}`}>
                                      {isSelected ? <Check size={16} /> : <Plus size={16} />}
                                    </div>
                                </button>
                              );
                          })}
                      </div>
                    )}
                </div>

                {selectedInModal.length > 0 && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                      <button 
                        onClick={handleAddSelectedToDaily} 
                        className="w-full bg-bigRed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-800 transition-colors"
                      >
                        <UserPlus size={20} /> Adicionar {selectedInModal.length} Selecionados
                      </button>
                  </div>
                )}
            </div>
        </div>
      )}

      {/* PENDING RECIPIENT MODAL */}
      {isPendingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Receipt size={24} className="text-gray-600" /> Selecionar Funcionário</h3>
                    <button onClick={() => setIsPendingModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar funcionário..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-400"
                      value={pendingSearchTerm}
                      onChange={(e) => setPendingSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 gap-2">
                        {filteredStaffForPending.map(staff => (
                            <button key={staff.id} onClick={() => handleSelectPendingRecipient(staff.name)} className="text-left bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-400 transition-all flex justify-between items-center group">
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-100">{staff.name}</p>
                                    <p className="text-[10px] text-gray-400 uppercase font-black">{staff.role}</p>
                                </div>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DailyClose;
