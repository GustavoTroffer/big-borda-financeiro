import React, { useState, useEffect, useRef } from 'react';
import { DailyCloseRecord, StaffMember, DailySales, DebtItem, PendingItem, StaffRole, AuditEntry, WeeklySchedule, DayOfWeek } from '../types';
import { getStaff, getRecordByDate, upsertRecord, generateId, getWeeklySchedule, getRecords } from '../services/storageService';
import { Save, Calendar, DollarSign, Users, UserMinus, Plus, Trash2, UserPlus, MessageSquare, Clock, CheckCircle2, UserCheck, Bike, MoreVertical, Check, X, ArrowRight, Utensils, Search, Smartphone, CreditCard, User, History, CalendarDays, UserCheck2, AlertCircle, RotateCcw } from 'lucide-react';

interface DailyCloseProps {
  isVisible: boolean;
  selectedDate?: string;
}

interface EditingItemState {
  id: string;
  type: 'debt' | 'pending';
}

const DailyClose: React.FC<DailyCloseProps> = ({ isVisible, selectedDate }) => {
  const [date, setDate] = useState<string>(selectedDate || new Date().toISOString().split('T')[0]);
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
  const [currentAuditLog, setCurrentAuditLog] = useState<AuditEntry[]>([]);

  // UI States - Modal selection
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<DayOfWeek | 'todos'>('todos');
  
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Previous Day Check States
  const [isPrevDayModalOpen, setIsPrevDayModalOpen] = useState(false);
  const [prevDayRecord, setPrevDayRecord] = useState<DailyCloseRecord | null>(null);
  const [paidPrevStaffIds, setPaidPrevStaffIds] = useState<Set<string>>(new Set());
  const [isManualPrevCheck, setIsManualPrevCheck] = useState(false);
  const hasCheckedPrevDay = useRef<Record<string, boolean>>({});

  // Editing State
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);
  
  // iFood Motoboys State
  const [ifoodRides, setIfoodRides] = useState<number[]>([]);

  // New Debt Input State
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');

  // New Pending Payable Input State
  const [newPendingName, setNewPendingName] = useState('');
  const [newPendingAmount, setNewPendingAmount] = useState('');
  const [newPendingDate, setNewPendingDate] = useState<string>('');
  const [isCustomPending, setIsCustomPending] = useState(false);

  // Sync data whenever visibility or date changes
  useEffect(() => {
    if (isVisible) {
      setStaffList(getStaff());
      setWeeklySchedule(getWeeklySchedule());
      
      const days: DayOfWeek[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const todayIndex = new Date().getDay();
      setSelectedDayFilter(days[todayIndex]);
    }
  }, [isVisible]);

  // Carrega o registro sempre que a data mudar ou a tela aparecer
  useEffect(() => {
    const record = getRecordByDate(date);
    if (record) {
      setSales({
        ifood: record.sales.ifood || 0,
        kcms: record.sales.kcms || (record.sales as any).app2 || 0,
        sgv: record.sales.sgv || (record.sales as any).app3 || 0,
      });
      setNotes(record.notes);
      setClosingStaffId(record.closedByStaffId || '');
      setCurrentAuditLog(record.auditLog || []);
      
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
      setCurrentAuditLog([]);
    }
    setSavedMessage('');
    setNewPendingDate(date);
    setIsCustomPending(false);
  }, [date, isVisible]);

  // Diff helper to identify changes
  const getChangesDescription = (oldRec: DailyCloseRecord, newRec: DailyCloseRecord): string => {
    const diffs: string[] = [];
    const fmt = (n: number) => `R$ ${n.toFixed(2)}`;

    // Sales
    if (oldRec.sales.ifood !== newRec.sales.ifood) diffs.push(`iFood: ${fmt(oldRec.sales.ifood)} → ${fmt(newRec.sales.ifood)}`);
    if (oldRec.sales.kcms !== newRec.sales.kcms) diffs.push(`KCMS: ${fmt(oldRec.sales.kcms)} → ${fmt(newRec.sales.kcms)}`);
    if (oldRec.sales.sgv !== newRec.sales.sgv) diffs.push(`SGV: ${fmt(oldRec.sales.sgv)} → ${fmt(newRec.sales.sgv)}`);

    // Payments
    const oldStaffMap = new Map(oldRec.payments.map(p => [p.staffId, p]));
    const newStaffMap = new Map(newRec.payments.map(p => [p.staffId, p]));

    newRec.payments.forEach(p => {
        const oldP = oldStaffMap.get(p.staffId);
        const staffName = staffList.find(s => s.id === p.staffId)?.name || 'Func.';
        if (!oldP) {
            diffs.push(`+ Pagamento: ${staffName} (${fmt(p.amount)})`);
        } else if (oldP.amount !== p.amount || oldP.deliveryCount !== p.deliveryCount) {
            diffs.push(`Valor ${staffName}: ${fmt(oldP.amount)} → ${fmt(p.amount)}`);
        }
    });
    oldRec.payments.forEach(p => {
        if (!newStaffMap.has(p.staffId)) {
            const staffName = staffList.find(s => s.id === p.staffId)?.name || 'Func.';
            diffs.push(`- Removido Pagamento: ${staffName}`);
        }
    });

    // Debts & Pendencies
    if (oldRec.debts.length !== newRec.debts.length) diffs.push(`Alt. Fiados (${oldRec.debts.length} → ${newRec.debts.length})`);
    if ((oldRec.pendingPayables?.length || 0) !== (newRec.pendingPayables?.length || 0)) diffs.push(`Alt. Pendências (${oldRec.pendingPayables?.length || 0} → ${newRec.pendingPayables?.length || 0})`);

    // Notes
    if (oldRec.notes !== newRec.notes) diffs.push(`Observações alteradas`);

    return diffs.length > 0 ? diffs.join(' | ') : 'Alteração em campos diversos';
  };

  const handleSelectPendingRecipient = (name: string, isCustom: boolean) => {
    setNewPendingName(name);
    setIsCustomPending(isCustom);
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

  const handleAddStaffToDaily = (staffId: string) => {
    if (staffId && !activeStaffIds.includes(staffId)) {
        setActiveStaffIds(prev => [...prev, staffId]);
    }
    setIsStaffModalOpen(false);
    setStaffSearchTerm('');
  };

  const handleBatchAddFromSchedule = () => {
    if (selectedDayFilter === 'todos') return;
    const scheduledIds = weeklySchedule?.[selectedDayFilter] || [];
    const idsToAdd = scheduledIds.filter(id => !activeStaffIds.includes(id));
    if (idsToAdd.length > 0) {
      setActiveStaffIds(prev => [...prev, ...idsToAdd]);
      setIsStaffModalOpen(false);
      setStaffSearchTerm('');
    }
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
    setIsCustomPending(false);
  };

  const deletePending = (id: string, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setPendingPayables(prev => prev.filter(p => p.id !== id));
  };

  const findLastRecord = () => {
    const records = getRecords();
    const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const currentIndex = sortedRecords.findIndex(r => r.date === date);
    
    return currentIndex !== -1 
        ? sortedRecords[currentIndex + 1] 
        : sortedRecords.find(r => r.date < date);
  };

  const handleSaveTrigger = () => {
    if (!closingStaffId) { alert("Por favor, selecione quem está realizando o fechamento."); return; }

    const lastRecord = findLastRecord();
    const isAlreadyChecked = hasCheckedPrevDay.current[date];

    if (lastRecord && !isAlreadyChecked && !getRecordByDate(date)) {
        setPrevDayRecord(lastRecord);
        setIsManualPrevCheck(false);
        setIsPrevDayModalOpen(true);
        setPaidPrevStaffIds(new Set());
    } else {
        performFinalSave();
    }
  };

  const handleManualPrevDayCheckOpen = () => {
    const lastRecord = findLastRecord();
    if (!lastRecord) {
        alert("Nenhum registro anterior encontrado para conferência.");
        return;
    }
    setPrevDayRecord(lastRecord);
    setIsManualPrevCheck(true);
    setIsPrevDayModalOpen(true);
    setPaidPrevStaffIds(new Set());
  };

  const togglePrevStaffPaid = (staffId: string) => {
    const next = new Set(paidPrevStaffIds);
    if (next.has(staffId)) next.delete(staffId);
    else next.add(staffId);
    setPaidPrevStaffIds(next);
  };

  const handleConfirmPrevDayCheck = () => {
    if (!prevDayRecord) return;

    const unpaidStaff = prevDayRecord.payments.filter(p => !paidPrevStaffIds.has(p.staffId));
    
    if (unpaidStaff.length > 0) {
        const formattedDate = prevDayRecord.date.split('-').reverse().join('/');
        const newPendencies: PendingItem[] = unpaidStaff.map(p => {
            const staff = staffList.find(s => s.id === p.staffId);
            return {
                id: generateId(),
                name: `${staff?.name || 'Desconhecido'} (Ref. ${formattedDate})`,
                amount: p.amount,
                date: prevDayRecord.date
            };
        });
        setPendingPayables(prev => [...prev, ...newPendencies]);
    }

    hasCheckedPrevDay.current[date] = true;
    setIsPrevDayModalOpen(false);
    
    if (!isManualPrevCheck) {
        performFinalSave(unpaidStaff);
    } else {
        setSavedMessage('Pendências adicionadas!');
        setTimeout(() => setSavedMessage(''), 3000);
    }
  };

  const performFinalSave = (unpaidStaffFromPrev?: any[]) => {
    const staffMember = staffList.find(s => s.id === closingStaffId);
    const staffName = staffMember?.name || 'Desconhecido';
    const existingRecord = getRecordByDate(date);
    const now = new Date().toISOString();
    
    const paymentList = activeStaffIds.map(staffId => ({
        staffId,
        amount: payments[staffId] || 0,
        deliveryCount: deliveryCounts[staffId] || 0
    })).filter(p => p.amount > 0);

    let finalPending = [...pendingPayables];
    if (unpaidStaffFromPrev && prevDayRecord) {
        const formattedDate = prevDayRecord.date.split('-').reverse().join('/');
        const extraPendencies = unpaidStaffFromPrev.map(p => {
            const staff = staffList.find(s => s.id === p.staffId);
            return {
                id: generateId(),
                name: `${staff?.name || 'Desconhecido'} (Ref. ${formattedDate})`,
                amount: p.amount,
                date: prevDayRecord.date
            };
        });
        finalPending = [...finalPending, ...extraPendencies];
    }

    const newRecord: DailyCloseRecord = {
      id: date, date, sales, payments: paymentList, debts, pendingPayables: finalPending,
      ifoodMotoboys: { count: ifoodRides.length, totalCost: ifoodRides.reduce((acc, curr) => acc + curr, 0), rides: ifoodRides },
      notes, closedByStaffId: closingStaffId, isClosed: true,
      createdAt: existingRecord?.createdAt || now, updatedAt: now
    };

    let auditLog = [...currentAuditLog];
    if (existingRecord) {
        const changes = getChangesDescription(existingRecord, newRecord);
        auditLog.push({ timestamp: now, staffName: staffName, action: changes });
    } else {
        auditLog.push({ timestamp: now, staffName: staffName, action: 'Fechamento inicial' });
    }

    newRecord.auditLog = auditLog;

    upsertRecord(newRecord);
    setCurrentAuditLog(auditLog);
    setSavedMessage('Salvo!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const totalSales = sales.ifood + sales.kcms + sales.sgv;
  const totalStaffPayments = (Object.values(payments) as number[]).reduce((a, b) => a + b, 0);
  const totalDebts = debts.reduce((a, b) => a + b.amount, 0);
  const totalPending = pendingPayables.reduce((a, b) => a + b.amount, 0);

  const getRoleIcon = (role: StaffRole) => {
      switch(role) {
          case StaffRole.MOTOBOY: return <Bike size={20} />;
          case StaffRole.KITCHEN: return <Utensils size={20} />;
          case StaffRole.ATENDENTE: return <UserCheck size={20} />;
          default: return <Users size={20} />;
      }
  };
  
  const getRoleColorClass = (role: StaffRole) => {
    switch(role) {
        case StaffRole.MOTOBOY: return "text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
        case StaffRole.KITCHEN: return "text-orange-500 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";
        case StaffRole.ATENDENTE: return "text-green-500 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800";
        default: return "text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200";
    }
  };

  const cardClass = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300";
  const sectionHeaderClass = "px-6 py-4 border-b border-gray-50 dark:border-gray-700 flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50";
  const sectionTitleClass = "font-bold text-gray-800 dark:text-white text-lg";
  const inputContainerClass = "relative transition-all duration-200";

  const availableStaffForPayments = staffList
    .filter(s => !activeStaffIds.includes(s.id))
    .filter(s => {
      if (selectedDayFilter === 'todos') return true;
      const scheduledIds = weeklySchedule?.[selectedDayFilter] || [];
      return scheduledIds.includes(s.id);
    })
    .filter(s => s.name.toLowerCase().includes(staffSearchTerm.toLowerCase()));

  const filteredStaffForPending = staffList
    .filter(s => s.name.toLowerCase().includes(pendingSearchTerm.toLowerCase()));

  const dayTabs: { key: DayOfWeek | 'todos'; label: string }[] = [
    { key: 'segunda', label: 'Seg' }, { key: 'terca', label: 'Ter' }, { key: 'quarta', label: 'Qua' }, 
    { key: 'quinta', label: 'Qui' }, { key: 'sexta', label: 'Sex' }, { key: 'sabado', label: 'Sab' }, 
    { key: 'domingo', label: 'Dom' }, { key: 'todos', label: 'Todos' },
  ];

  const getPendingScheduledCount = () => {
    if (selectedDayFilter === 'todos') return 0;
    const scheduledIds = weeklySchedule?.[selectedDayFilter] || [];
    return scheduledIds.filter(id => !activeStaffIds.includes(id)).length;
  };

  const pendingBatchCount = getPendingScheduledCount();

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
            {currentAuditLog.length > 1 && (
                <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-colors">
                    <History size={14} /> Editado {currentAuditLog.length - 1}x
                </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-bigRed w-full md:w-64 transition-all">
              <UserCheck className="w-5 h-5 text-bigRed dark:text-red-400 ml-2" />
              <select value={closingStaffId} onChange={(e) => setClosingStaffId(e.target.value)} className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-bold outline-none text-sm w-full cursor-pointer">
                <option value="" className="text-gray-400">Quem está fechando?</option>
                {staffList.filter(s => s.role === StaffRole.ATENDENTE).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-bigYellow w-full md:w-auto transition-all">
              <Calendar className="w-5 h-5 text-bigRed dark:text-red-400 ml-2" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 font-bold outline-none w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <div className={inputContainerClass}>
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

          <div className={`${cardClass} border-t-4 border-t-bigYellow`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigYellow/10 dark:bg-bigYellow/20 rounded text-bigYellow"><UserMinus size={18} /></div>
              <div><h3 className={sectionTitleClass}>Fiado / Clientes</h3><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Receber Futuramente</p></div>
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
        </div>

        <div className="space-y-6">
          <div className={`${cardClass} border-t-4 border-t-bigRed`}>
            <div className={sectionHeaderClass}>
              <div className="p-1.5 bg-bigRed/10 dark:bg-bigRed/20 rounded text-bigRed"><Users size={18} /></div>
              <h3 className={sectionTitleClass}>Pagamentos (Equipe)</h3>
            </div>
            <div className="p-6">
                <button onClick={() => setIsStaffModalOpen(true)} className="w-full py-3 bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-bigRed transition-all flex items-center justify-center gap-2 group mb-6 transition-all duration-300"><Plus /> Adicionar Pagamento / Funcionário</button>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {activeStaffIds.length === 0 ? (<div className="text-center py-8 text-gray-400 text-sm">Nenhum pagamento hoje.</div>) : activeStaffIds.map(staffId => {
                        const staff = staffList.find(s => s.id === staffId);
                        if (!staff) return null;
                        return (
                            <div key={staff.id} className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-between gap-3 group">
                                <div className="flex-1 min-w-0"><p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{staff.name}</p><p className="text-[10px] text-gray-400 uppercase tracking-wide">{staff.role}</p></div>
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

          <div className={`${cardClass} border-t-4 border-t-bigRed`}>
            <div className={sectionHeaderClass}>
                <div className="p-1.5 bg-bigRed/10 dark:bg-bigRed/20 rounded text-bigRed"><Clock size={18} /></div>
                <div><h3 className={sectionTitleClass}>Pendências a Pagar</h3><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Dívidas do Restaurante</p></div>
            </div>
            <div className="p-6">
                <div className="flex flex-col gap-3 mb-6 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex gap-2 items-center">
                         {isCustomPending ? (
                            <div className="relative w-full">
                                <input type="text" placeholder="Nome ou Motivo..." className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none text-gray-700 dark:text-gray-200 pr-8" value={newPendingName} onChange={(e) => setNewPendingName(e.target.value)} autoFocus />
                                <button onClick={() => { setIsCustomPending(false); setNewPendingName(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
                            </div>
                         ) : (
                            <button onClick={() => setIsPendingModalOpen(true)} className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between hover:border-bigRed transition-all">{newPendingName || "Selecionar Pessoa/Motivo..."}<UserPlus size={16} className="text-bigRed" /></button>
                         )}
                    </div>
                    <div className="flex gap-2">
                        <input type="date" className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none" value={newPendingDate} onChange={(e) => setNewPendingDate(e.target.value)} />
                        <div className="relative w-32">
                            <input type="number" step="0.01" placeholder="0,00" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-right outline-none font-medium" value={newPendingAmount} onChange={(e) => setNewPendingAmount(e.target.value)} onBlur={(e) => handleBlurCurrency(setNewPendingAmount, e.target.value)} />
                        </div>
                        <button onClick={handleAddPending} className="bg-bigRed text-white px-3 rounded-lg hover:bg-red-800 transition-colors shadow-sm"><Plus size={18} /></button>
                    </div>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                    {pendingPayables.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-700 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all">
                            <div><p className="text-gray-800 dark:text-gray-200 font-medium text-sm">{item.name}</p>{item.date && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={10} /> {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}</div>
                            <div className="flex items-center gap-1"><span className="font-mono font-bold text-bigRed text-sm mr-2">R$ {item.amount.toFixed(2)}</span><button onClick={(e) => deletePending(item.id, e)} className="text-gray-300 hover:text-red-500 p-2 rounded-full"><Trash2 size={16} /></button></div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"><MessageSquare size={16} className="text-bigYellow" /> Observações Gerais do Dia</label>
        <textarea rows={3} className="w-full p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none text-gray-700 dark:text-gray-200 text-sm" placeholder="Ex: Diferença de caixa de R$ 10,00; Motoboy X saiu mais cedo..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 flex justify-end items-center gap-3 z-40 md:static md:bg-transparent md:border-none md:p-0 md:mt-8">
        {savedMessage && <div className="mr-auto hidden md:flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg"><CheckCircle2 size={18} /> {savedMessage}</div>}
        
        <button 
            onClick={handleManualPrevDayCheckOpen} 
            className="px-6 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-black text-sm uppercase hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center gap-2"
        >
            <Clock size={20} className="text-bigRed" />
            <span className="hidden sm:inline">Verificar Dia Anterior</span>
            <span className="sm:hidden">Anterior</span>
        </button>

        <button 
            onClick={handleSaveTrigger} 
            className="bg-gradient-to-r from-bigRed to-red-800 text-white px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 font-bold text-lg flex-1 md:flex-none justify-center"
        >
            <Save size={20} /> Salvar Fechamento
        </button>
      </div>

      {/* PREVIOUS DAY CHECK MODAL */}
      {isPrevDayModalOpen && prevDayRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden transform animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-gradient-to-br from-bigRed to-red-900 text-white relative">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="text-bigYellow" size={28} />
                        <h3 className="text-xl font-black uppercase tracking-tight">Pagamentos Pendentes</h3>
                    </div>
                    <p className="text-red-100 text-sm opacity-90">Verifique se os funcionários do dia anterior (<b>{prevDayRecord.date.split('-').reverse().join('/')}</b>) foram pagos.</p>
                    <p className="text-xs text-bigYellow mt-2 font-bold uppercase tracking-widest">Os não marcados serão lançados como pendência hoje.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 max-h-[50vh] custom-scrollbar bg-gray-50 dark:bg-gray-900/40">
                    <div className="space-y-3">
                        {prevDayRecord.payments.map((p) => {
                            const staff = staffList.find(s => s.id === p.staffId);
                            const isPaid = paidPrevStaffIds.has(p.staffId);
                            return (
                                <button 
                                    key={p.staffId} 
                                    onClick={() => togglePrevStaffPaid(p.staffId)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left
                                      ${isPaid 
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 shadow-sm' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-bigRed/50'
                                      }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                                          ${isPaid ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {isPaid && <Check size={14} strokeWidth={4} />}
                                        </div>
                                        <div>
                                            <p className={`font-black text-sm ${isPaid ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'}`}>
                                                {staff?.name || 'Desconhecido'}
                                            </p>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                {staff?.role}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-mono font-black ${isPaid ? 'text-green-600' : 'text-bigRed'}`}>
                                            R$ {p.amount.toFixed(2)}
                                        </p>
                                        <p className="text-[9px] text-gray-400 uppercase font-black">
                                            {isPaid ? 'Pago' : 'A pagar'}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-3">
                    <button 
                        onClick={() => { setIsPrevDayModalOpen(false); }} 
                        className="flex-1 py-3.5 px-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-black text-sm uppercase hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirmPrevDayCheck} 
                        className="flex-[2] py-3.5 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm uppercase shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isManualPrevCheck ? 'Confirmar Pendências' : 'Confirmar e Salvar'} <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* STAFF SELECTION MODAL */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Users size={24} className="text-bigRed" /> Selecionar Funcionário</h3>
                        <p className="text-sm text-gray-500">Escolha quem trabalhou hoje</p>
                    </div>
                    <button onClick={() => { setIsStaffModalOpen(false); setStaffSearchTerm(''); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-900/20 px-4 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays size={16} className="text-bigYellow" />
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Escala do Dia</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pb-2">
                    {dayTabs.map((day) => (
                      <button
                        key={day.key}
                        onClick={() => setSelectedDayFilter(day.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                          ${selectedDayFilter === day.key 
                            ? 'bg-bigRed text-white border-bigRed shadow-sm scale-105' 
                            : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-bigRed/50'
                          }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  {selectedDayFilter !== 'todos' && pendingBatchCount > 0 && (
                    <div className="pb-4 animate-in slide-in-from-top-2 duration-300">
                       <button
                        onClick={handleBatchAddFromSchedule}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                       >
                         <UserCheck2 size={18} />
                         CONFIRMAR ADIÇÃO DE {pendingBatchCount} FUNCIONÁRIOS ({selectedDayFilter.toUpperCase()})
                       </button>
                    </div>
                  )}
                </div>

                <div className="p-4 border-b border-gray-50 dark:border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Buscar por nome manualmente..." className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-xl outline-none text-gray-700 dark:text-gray-200" value={staffSearchTerm} onChange={(e) => setStaffSearchTerm(e.target.value)} />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {availableStaffForPayments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p>Ninguém encontrado para esta seleção.</p>
                        <button onClick={() => setSelectedDayFilter('todos')} className="mt-4 text-bigRed font-bold text-sm underline">Mostrar todos os funcionários</button>
                      </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                            {availableStaffForPayments.map((staff) => (
                                <button key={staff.id} onClick={() => handleAddStaffToDaily(staff.id)} className="text-left group bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-bigRed transition-all shadow-sm hover:shadow-md">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${getRoleColorClass(staff.role)} bg-opacity-10`}>{getRoleIcon(staff.role)}</div>
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-bigRed transition-colors truncate max-w-[120px]">{staff.name}</h4>
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRoleColorClass(staff.role)} bg-opacity-10 border-opacity-30`}>{staff.role}</span>
                                            </div>
                                        </div>
                                        <div className="text-gray-300 group-hover:text-bigRed"><Plus size={24} /></div>
                                    </div>
                                    <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-2 text-xs text-gray-500"><CreditCard size={12} /><span className="font-mono truncate">{staff.pixKey}</span></div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500"><Smartphone size={12} /><span>{staff.phone}</span></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* PENDING MODAL SELECTION */}
      {isPendingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Clock size={24} className="text-bigRed" /> Selecionar Pessoa/Motivo</h3>
                        <p className="text-sm text-gray-500">Para quem é esta pendência financeira?</p>
                    </div>
                    <button onClick={() => { setIsPendingModalOpen(false); setPendingSearchTerm(''); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X size={24} /></button>
                </div>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Buscar funcionário ou digite..." className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 rounded-xl outline-none" value={pendingSearchTerm} onChange={(e) => setPendingSearchTerm(e.target.value)} autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => handleSelectPendingRecipient('', true)} className="text-left group bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-100 transition-all flex flex-col items-center justify-center border-dashed"><Plus size={32} className="text-bigRed mb-2" /><span className="font-bold text-bigRed">Digitar outro motivo</span></button>
                        {filteredStaffForPending.map((staff) => (
                            <button key={staff.id} onClick={() => handleSelectPendingRecipient(staff.name, false)} className="text-left group bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-bigRed transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${getRoleColorClass(staff.role)} bg-opacity-10`}>{getRoleIcon(staff.role)}</div>
                                        <div><h4 className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-bigRed transition-colors">{staff.name}</h4><span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRoleColorClass(staff.role)} bg-opacity-10 border-opacity-30`}>{staff.role}</span></div>
                                    </div>
                                    <div className="text-gray-300 group-hover:text-bigRed"><Check size={24} /></div>
                                </div>
                                <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800"><div className="flex items-center gap-2 text-xs text-gray-500"><Smartphone size={12} /><span>{staff.phone}</span></div></div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* CHANGE TRACKING / HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-lg flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50"><h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><History size={24} className="text-blue-500" /> Histórico de Alterações</h3><button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-700">
                        {currentAuditLog.map((log, i) => (
                            <div key={i} className="relative pl-8">
                                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-blue-500 flex items-center justify-center z-10"><div className="w-2 h-2 rounded-full bg-blue-500"></div></div>
                                <div className="bg-white dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">Por: {log.staffName}</p>
                                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{log.action}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 text-center"><button onClick={() => setShowHistoryModal(false)} className="w-full py-2.5 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors">Fechar</button></div>
             </div>
        </div>
      )}
    </div>
  );
};

export default DailyClose;