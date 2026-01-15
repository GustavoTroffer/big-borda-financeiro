
import React, { useState, useEffect } from 'react';
import { StaffMember, StaffRole, DailyCloseRecord, DeliveryCommand, DayOfWeek } from '../types';
import { getStaff, getRecordByDate, upsertRecord, generateId, getWeeklySchedule } from '../services/storageService';
import { Bike, Plus, X, Check, CreditCard, Hash, DollarSign, Trash2, AlertCircle, Banknote, ChevronDown, MapPin, Pencil, PieChart, Wallet } from 'lucide-react';

interface DeliveryControlProps {
  isVisible: boolean;
}

const DeliveryControl: React.FC<DeliveryControlProps> = ({ isVisible }) => {
  const getTodayLocalDate = () => new Date().toLocaleDateString('en-CA');
  const today = getTodayLocalDate();
  
  const [activeMotoboys, setActiveMotoboys] = useState<StaffMember[]>([]);
  const [record, setRecord] = useState<DailyCloseRecord | null>(null);
  const [selectedMotoboy, setSelectedMotoboy] = useState<StaffMember | null>(null);
  const [editingCommand, setEditingCommand] = useState<DeliveryCommand | null>(null);
  
  // Modal states for launching delivery
  const [commandCode, setCommandCode] = useState('');
  const [commandType, setCommandType] = useState('IFOOD');
  const [paymentMethod, setPaymentMethod] = useState('Cartão');
  const [commandAmount, setCommandAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');

  const loadData = () => {
    const allStaff = getStaff();
    const currentRecord = getRecordByDate(today);
    setRecord(currentRecord || null);

    const schedule = getWeeklySchedule();
    const days: DayOfWeek[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const todayDay = days[new Date().getDay()];
    const scheduledIds = schedule[todayDay] || [];

    const activeIds = new Set<string>(scheduledIds);
    if (currentRecord) {
      currentRecord.payments.forEach(p => activeIds.add(p.staffId));
      if (currentRecord.motoboyCommands) {
        Object.keys(currentRecord.motoboyCommands).forEach(id => activeIds.add(id));
      }
    }

    const filteredMotoboys = allStaff.filter(s => s.role === StaffRole.MOTOBOY && activeIds.has(s.id));
    setActiveMotoboys(filteredMotoboys);
  };

  useEffect(() => {
    if (isVisible) {
      loadData();
    }
  }, [isVisible]);

  const handleOpenModal = (motoboy: StaffMember) => {
    setSelectedMotoboy(motoboy);
    setEditingCommand(null);
    setCommandCode('');
    setCommandAmount('');
    setDeliveryFee('');
    setCommandType('IFOOD');
    setPaymentMethod('Cartão');
  };

  const handleEditOpen = (motoboy: StaffMember, command: DeliveryCommand) => {
    setSelectedMotoboy(motoboy);
    setEditingCommand(command);
    setCommandCode(command.code);
    setCommandAmount(command.amount.toString());
    setDeliveryFee(command.deliveryFee?.toString() || '');
    setCommandType(command.type);
    setPaymentMethod(command.paymentMethod || 'Cartão');
  };

  const getUpdatedRecordTemplate = (): DailyCloseRecord => {
    return record ? { ...record } : {
      id: today,
      date: today,
      sales: { ifood: 0, kcms: 0, sgv: 0 },
      payments: [],
      debts: [],
      pendingPayables: [],
      notes: '',
      isClosed: false,
      motoboyCommands: {}
    };
  };

  const syncDeliveryCountToRecord = (updatedRecord: DailyCloseRecord, motoboyId: string) => {
    const totalDeliveries = updatedRecord.motoboyCommands?.[motoboyId]?.length || 0;
    const existingPaymentIndex = updatedRecord.payments.findIndex(p => p.staffId === motoboyId);
    
    if (existingPaymentIndex >= 0) {
      updatedRecord.payments[existingPaymentIndex].deliveryCount = totalDeliveries;
    } else {
      updatedRecord.payments.push({
        staffId: motoboyId,
        amount: 0,
        deliveryCount: totalDeliveries,
        isPaid: false
      });
    }
  };

  const handleAddCommand = () => {
    if (!selectedMotoboy || !commandCode || !commandAmount) return;
    
    const amount = parseFloat(commandAmount.replace(',', '.'));
    const fee = parseFloat(deliveryFee.replace(',', '.')) || 0;
    
    if (isNaN(amount)) return;

    const updatedRecord = getUpdatedRecordTemplate();
    if (!updatedRecord.motoboyCommands) updatedRecord.motoboyCommands = {};
    if (!updatedRecord.motoboyCommands[selectedMotoboy.id]) {
      updatedRecord.motoboyCommands[selectedMotoboy.id] = [];
    }

    if (editingCommand) {
      updatedRecord.motoboyCommands[selectedMotoboy.id] = updatedRecord.motoboyCommands[selectedMotoboy.id].map(cmd => 
        cmd.id === editingCommand.id 
          ? { ...cmd, code: commandCode, type: commandType, paymentMethod, amount, deliveryFee: fee }
          : cmd
      );
    } else {
      const newCommand: DeliveryCommand = {
        id: generateId(),
        code: commandCode,
        type: commandType,
        paymentMethod: paymentMethod,
        amount: amount,
        deliveryFee: fee,
        timestamp: new Date().toISOString()
      };
      updatedRecord.motoboyCommands[selectedMotoboy.id].push(newCommand);
    }
    
    syncDeliveryCountToRecord(updatedRecord, selectedMotoboy.id);
    upsertRecord(updatedRecord);
    setRecord({ ...updatedRecord }); 
    setSelectedMotoboy(null);
    setEditingCommand(null);
  };

  const removeCommand = (motoboyId: string, commandId: string) => {
    if (!record || !record.motoboyCommands || !record.motoboyCommands[motoboyId]) return;
    
    if (window.confirm("Deseja remover esta entrega?")) {
        const updatedRecord = JSON.parse(JSON.stringify(record));
        if (updatedRecord.motoboyCommands && updatedRecord.motoboyCommands[motoboyId]) {
            updatedRecord.motoboyCommands[motoboyId] = updatedRecord.motoboyCommands[motoboyId].filter((c: any) => c.id !== commandId);
            syncDeliveryCountToRecord(updatedRecord, motoboyId);
            upsertRecord(updatedRecord);
            setRecord(updatedRecord);
        }
    }
  };

 
  const getAllCommands = () => {
    if (!record || !record.motoboyCommands) return [];
    return Object.values(record.motoboyCommands).flat();
  };

  const commands = getAllCommands();
  const totalsByPayment = commands.reduce((acc, cmd) => {
    const method = cmd.paymentMethod || 'N/I';
    
    acc[method] = (acc[method] || 0) + cmd.amount;
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = Object.values(totalsByPayment).reduce((a, b) => a + b, 0);

  const paymentColors: Record<string, string> = {
    'Cartão': 'bg-blue-500',
    'Pix': 'bg-green-500',
    'Dinheiro': 'bg-orange-500',
    'Fiado': 'bg-red-500',
    'Pago iFood': 'bg-purple-500',
    'N/I': 'bg-gray-400'
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-12 pb-32">
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-bigRed p-2 rounded-lg text-white shadow-md">
              <Bike size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-bigRed dark:text-red-400">Controle de Motoboys</h2>
              <p className="text-sm text-gray-500 uppercase font-bold tracking-widest">Lançamento de Entregas</p>
            </div>
          </div>
        </div>

        {/* DASHBOARD DE PAGAMENTOS (GRÁFICO) */}
        {commands.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-10">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="text-bigYellow" size={20} />
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest">Resumo de Recebimentos</h3>
            </div>
            
            <div className="space-y-6">
              {/* Barra Consolidada (Gráfico de Barras Empilhadas) */}
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex shadow-inner">
                {Object.entries(totalsByPayment).map(([method, amount]) => {
                  const percentage = (amount / grandTotal) * 100;
                  return (
                    <div 
                      key={method}
                      style={{ width: `${percentage}%` }}
                      className={`${paymentColors[method] || 'bg-gray-400'} h-full transition-all duration-500`}
                      title={`${method}: R$ ${amount.toFixed(2)}`}
                    />
                  );
                })}
              </div>

              {/* Legenda e Valores Individuais */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {['Pago iFood', 'Dinheiro', 'Pix', 'Fiado', 'Cartão'].map((method) => {
                  const val = totalsByPayment[method] || 0;
                  const perc = grandTotal > 0 ? (val / grandTotal) * 100 : 0;
                  return (
                    <div key={method} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${paymentColors[method]}`} />
                        <span className="text-[10px] font-black text-gray-400 uppercase truncate">{method}</span>
                      </div>
                      <span className="text-sm font-black text-gray-800 dark:text-white">R$ {val.toFixed(2)}</span>
                      <span className="text-[9px] text-gray-400 font-bold">{perc.toFixed(1)}% do total</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeMotoboys.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
             <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <p className="text-gray-500 font-medium text-lg">Nenhum motoboy ativo para hoje.</p>
             <p className="text-sm text-gray-400 mt-2">Configure a escala semanal na aba <span className="font-bold text-bigRed">Equipe</span> ou adicione um motoboy no <span className="font-bold text-bigRed">Fechamento</span> e salve o registro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMotoboys.map(moto => {
              const motoCommands = record?.motoboyCommands?.[moto.id] || [];
              const totalFees = motoCommands.reduce((acc, c) => acc + (c.deliveryFee || 0), 0);
              
              return (
                <div key={moto.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group hover:shadow-md transition-all relative">
                  <div className="p-5 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-bigRed text-white flex items-center justify-center font-black">
                          {moto.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-white leading-tight">{moto.name}</h3>
                          <span className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">{moto.shift}</span>
                        </div>
                     </div>
                     <button 
                      onClick={() => handleOpenModal(moto)}
                      className="p-2 bg-bigYellow text-white rounded-lg hover:brightness-90 transition-all shadow-sm"
                      title="Adicionar Entrega"
                     >
                      <Plus size={20} />
                     </button>
                  </div>
                  
                  <div className="p-4 flex-1">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entregas ({motoCommands.length})</span>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-0.5">Total Taxas</span>
                          <span className="text-sm font-black text-bigRed">R$ {totalFees.toFixed(2)}</span>
                        </div>
                     </div>
                     
                     <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {motoCommands.length === 0 ? (
                          <p className="text-center py-6 text-xs text-gray-400 italic">Sem entregas lançadas.</p>
                        ) : (
                          motoCommands.map(cmd => (
                            <div key={cmd.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 group/item">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">#{cmd.code}</span>
                                    <span className={`text-[8px] px-1 py-0.5 rounded border border-gray-100 dark:border-gray-700 font-black uppercase ${paymentColors[cmd.paymentMethod || '']?.replace('bg-', 'text-') || 'text-gray-400'} bg-white dark:bg-gray-800`}>
                                      {cmd.paymentMethod || 'N/I'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] uppercase font-black text-gray-400">{cmd.type}</span>
                                    {cmd.deliveryFee && cmd.deliveryFee > 0 && (
                                        <span className="text-[8px] bg-bigYellow/20 text-bigYellow px-1 rounded font-black">TAXA: R${cmd.deliveryFee.toFixed(2)}</span>
                                    )}
                                  </div>
                               </div>
                               <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-end mr-1">
                                    {/* AJUSTE: Exibe apenas o amount do pedido, sem somar a taxa */}
                                    <span className="font-mono font-bold text-xs text-gray-700 dark:text-gray-200">R$ {cmd.amount.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                     <button onClick={() => handleEditOpen(moto, cmd)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Editar"><Pencil size={14} /></button>
                                     <button 
                                      type="button"
                                      onClick={() => removeCommand(moto.id, cmd.id)} 
                                      className="text-gray-400 hover:text-red-500 transition-colors p-1.5 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 shadow-sm active:scale-95 flex items-center justify-center" 
                                      title="Excluir"
                                     >
                                      <Trash2 size={16} />
                                     </button>
                                  </div>
                               </div>
                            </div>
                          ))
                        )}
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* POP-UP MODAL: ADD/EDIT DELIVERY */}
      {selectedMotoboy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-bigYellow/10 text-bigYellow rounded-lg">
                    <Bike size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white leading-none">
                      {editingCommand ? 'Editar Entrega' : 'Nova Entrega'}
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">{selectedMotoboy.name}</p>
                  </div>
               </div>
               <button onClick={() => { setSelectedMotoboy(null); setEditingCommand(null); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Código da Entrega</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="Ex: 1234"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold"
                    value={commandCode}
                    onChange={(e) => setCommandCode(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Origem</label>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
                    <select 
                      className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold appearance-none"
                      value={commandType}
                      onChange={(e) => setCommandType(e.target.value)}
                    >
                      <option value="IFOOD">IFOOD</option>
                      <option value="KCMS">KCMS</option>
                      <option value="SGV">SGV</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Pagamento</label>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
                    <select 
                      className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold appearance-none"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Pago iFood">Pago iFood</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Pix">Pix</option>
                      <option value="Fiado">Fiado</option>
                      <option value="Cartão">Cartão</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Valor do Pedido (Total)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold"
                      value={commandAmount}
                      onChange={(e) => setCommandAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Taxa (Já Inclusa)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700">
               <button 
                onClick={handleAddCommand}
                className="w-full bg-bigRed text-white py-4 rounded-xl font-black text-lg shadow-lg hover:brightness-90 transition-all flex items-center justify-center gap-2"
               >
                 <Check size={24} /> {editingCommand ? 'Salvar Alterações' : 'Confirmar Lançamento'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryControl;
