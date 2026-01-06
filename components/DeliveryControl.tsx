
import React, { useState, useEffect } from 'react';
import { StaffMember, StaffRole, DailyCloseRecord, DeliveryCommand, DayOfWeek } from '../types';
import { getStaff, getRecordByDate, upsertRecord, generateId, getWeeklySchedule } from '../services/storageService';
import { Bike, Plus, X, Check, CreditCard, Hash, DollarSign, Trash2, AlertCircle, Banknote, ChevronDown } from 'lucide-react';

interface DeliveryControlProps {
  isVisible: boolean;
}

const DeliveryControl: React.FC<DeliveryControlProps> = ({ isVisible }) => {
  const getTodayLocalDate = () => new Date().toLocaleDateString('en-CA');
  const today = getTodayLocalDate();
  
  const [activeMotoboys, setActiveMotoboys] = useState<StaffMember[]>([]);
  const [record, setRecord] = useState<DailyCloseRecord | null>(null);
  const [selectedMotoboy, setSelectedMotoboy] = useState<StaffMember | null>(null);
  
  // Modal states for launching command
  const [commandCode, setCommandCode] = useState('');
  const [commandType, setCommandType] = useState('IFOOD');
  const [paymentMethod, setPaymentMethod] = useState('Cartão');
  const [commandAmount, setCommandAmount] = useState('');

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
    setCommandCode('');
    setCommandAmount('');
    setCommandType('IFOOD');
    setPaymentMethod('Cartão');
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

  const handleAddCommand = () => {
    if (!selectedMotoboy || !commandCode || !commandAmount) return;
    
    const amount = parseFloat(commandAmount.replace(',', '.'));
    if (isNaN(amount)) return;

    const newCommand: DeliveryCommand = {
      id: generateId(),
      code: commandCode,
      type: commandType,
      paymentMethod: paymentMethod,
      amount: amount,
      timestamp: new Date().toISOString()
    };

    const updatedRecord = getUpdatedRecordTemplate();

    if (!updatedRecord.motoboyCommands) updatedRecord.motoboyCommands = {};
    if (!updatedRecord.motoboyCommands[selectedMotoboy.id]) {
      updatedRecord.motoboyCommands[selectedMotoboy.id] = [];
    }

    updatedRecord.motoboyCommands[selectedMotoboy.id].push(newCommand);
    
    const existingPaymentIndex = updatedRecord.payments.findIndex(p => p.staffId === selectedMotoboy.id);
    const totalDeliveries = updatedRecord.motoboyCommands[selectedMotoboy.id].length;
    
    if (existingPaymentIndex >= 0) {
      updatedRecord.payments[existingPaymentIndex].deliveryCount = totalDeliveries;
    } else {
      updatedRecord.payments.push({
        staffId: selectedMotoboy.id,
        amount: 0,
        deliveryCount: totalDeliveries,
        isPaid: false
      });
    }

    upsertRecord(updatedRecord);
    setRecord(updatedRecord);
    setSelectedMotoboy(null);
  };

  const removeCommand = (motoboyId: string, commandId: string) => {
    if (!record || !record.motoboyCommands || !record.motoboyCommands[motoboyId]) return;
    
    if (window.confirm("Deseja remover esta comanda?")) {
        const updatedRecord = { ...record };
        updatedRecord.motoboyCommands![motoboyId] = updatedRecord.motoboyCommands![motoboyId].filter(c => c.id !== commandId);
        
        const payIndex = updatedRecord.payments.findIndex(p => p.staffId === motoboyId);
        if (payIndex >= 0) {
            updatedRecord.payments[payIndex].deliveryCount = updatedRecord.motoboyCommands![motoboyId].length;
        }

        upsertRecord(updatedRecord);
        setRecord(updatedRecord);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-12 pb-32">
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-bigRed p-2 rounded-lg text-white shadow-md">
              <Bike size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-bigRed dark:text-red-400">Controle de Motoboys</h2>
              <p className="text-sm text-gray-500 uppercase font-bold tracking-widest">Lançamento de Comandas</p>
            </div>
          </div>
        </div>

        {activeMotoboys.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
             <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <p className="text-gray-500 font-medium text-lg">Nenhum motoboy ativo para hoje.</p>
             <p className="text-sm text-gray-400 mt-2">Configure a escala semanal na aba <span className="font-bold text-bigRed">Equipe</span> ou adicione um motoboy no <span className="font-bold text-bigRed">Fechamento</span> e salve o registro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMotoboys.map(moto => {
              const commands = record?.motoboyCommands?.[moto.id] || [];
              const totalValue = commands.reduce((acc, c) => acc + c.amount, 0);
              
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
                      title="Adicionar Comanda"
                     >
                      <Plus size={20} />
                     </button>
                  </div>
                  
                  <div className="p-4 flex-1">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comandas ({commands.length})</span>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-0.5">Soma Total</span>
                          <span className="text-sm font-black text-bigRed">R$ {totalValue.toFixed(2)}</span>
                        </div>
                     </div>
                     
                     <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {commands.length === 0 ? (
                          <p className="text-center py-6 text-xs text-gray-400 italic">Sem comandas lançadas.</p>
                        ) : (
                          commands.map(cmd => (
                            <div key={cmd.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 group/item">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">#{cmd.code}</span>
                                    <span className="text-[8px] bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-100 dark:border-gray-700 font-black text-gray-400 uppercase">{cmd.paymentMethod || 'N/I'}</span>
                                  </div>
                                  <span className="text-[8px] uppercase font-black text-gray-400">{cmd.type}</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-xs">R$ {cmd.amount.toFixed(2)}</span>
                                  <button onClick={() => removeCommand(moto.id, cmd.id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"><Trash2 size={14} /></button>
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

      {/* POP-UP MODAL: ADD COMMAND */}
      {selectedMotoboy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-bigYellow/10 text-bigYellow rounded-lg">
                    <Bike size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white leading-none">Nova Comanda</h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">{selectedMotoboy.name}</p>
                  </div>
               </div>
               <button onClick={() => setSelectedMotoboy(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Código da Comanda</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="Ex: 1234"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold"
                    value={commandCode}
                    onChange={(e) => setCommandCode(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Origem da Comanda</label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
                  <select 
                    className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold appearance-none"
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
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Forma de Pagamento</label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={18} />
                  <select 
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold appearance-none"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cartão">Cartão</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Fiado">Fiado</option>
                    <option value="PagoIfood">PagoIfood</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Valor da Comanda</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-bigYellow text-sm font-bold"
                    value={commandAmount}
                    onChange={(e) => setCommandAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700">
               <button 
                onClick={handleAddCommand}
                className="w-full bg-bigRed text-white py-4 rounded-xl font-black text-lg shadow-lg hover:brightness-90 transition-all flex items-center justify-center gap-2"
               >
                 <Check size={24} /> Confirmar Lançamento
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryControl;
