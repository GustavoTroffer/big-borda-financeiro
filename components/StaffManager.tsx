import React, { useState, useEffect } from 'react';
import { StaffMember, StaffRole, DayOfWeek, WeeklySchedule } from '../types';
import { getStaff, saveStaff, generateId, getWeeklySchedule, saveWeeklySchedule } from '../services/storageService';
import { Trash2, UserPlus, Phone, CreditCard, User, Pencil, X, Save, CheckCircle2, CalendarDays, Check } from 'lucide-react';

const StaffManager: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  
  // Form States
  const [newName, setNewName] = useState('');
  const [newPix, setNewPix] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>(StaffRole.MOTOBOY);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  // Schedule State
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: []
  });
  const [activeDay, setActiveDay] = useState<DayOfWeek>('segunda');

  useEffect(() => {
    setStaffList(getStaff());
    setSchedule(getWeeklySchedule());
  }, []);

  const resetForm = () => {
    setNewName('');
    setNewPix('');
    setNewPhone('');
    setNewRole(StaffRole.MOTOBOY);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!newName || !newPix) {
        alert("Nome e Chave PIX são obrigatórios.");
        return;
    }

    let updatedList = [...staffList];

    if (editingId) {
        // Update existing member
        updatedList = updatedList.map(staff => {
            if (staff.id === editingId) {
                return {
                    ...staff,
                    name: newName,
                    pixKey: newPix,
                    phone: newPhone,
                    role: newRole
                };
            }
            return staff;
        });
        setSavedMessage('Funcionário atualizado!');
    } else {
        // Create new member
        const newMember: StaffMember = {
            id: generateId(),
            name: newName,
            pixKey: newPix,
            phone: newPhone,
            role: newRole,
        };
        updatedList.push(newMember);
        setSavedMessage('Funcionário cadastrado!');
    }

    setStaffList(updatedList);
    saveStaff(updatedList);
    
    // Clear message after 3 seconds
    setTimeout(() => setSavedMessage(''), 3000);
    
    // Explicitly clear all fields
    resetForm();
  };

  const startEditing = (staff: StaffMember) => {
    setEditingId(staff.id);
    setNewName(staff.name);
    setNewPix(staff.pixKey);
    setNewPhone(staff.phone);
    setNewRole(staff.role);
    
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este funcionário?")) {
      const updatedList = staffList.filter(s => s.id !== id);
      setStaffList(updatedList);
      saveStaff(updatedList);
      
      // Also remove from schedule
      const updatedSchedule = { ...schedule };
      Object.keys(updatedSchedule).forEach(day => {
        updatedSchedule[day] = updatedSchedule[day].filter(staffId => staffId !== id);
      });
      setSchedule(updatedSchedule);
      saveWeeklySchedule(updatedSchedule);

      if (editingId === id) {
          resetForm();
      }
    }
  };

  // Schedule Logic
  const toggleStaffOnDay = (staffId: string) => {
    setSchedule(prev => {
        const currentDayList = prev[activeDay] || [];
        let newDayList;
        
        if (currentDayList.includes(staffId)) {
            newDayList = currentDayList.filter(id => id !== staffId);
        } else {
            newDayList = [...currentDayList, staffId];
        }

        const newSchedule = { ...prev, [activeDay]: newDayList };
        saveWeeklySchedule(newSchedule);
        return newSchedule;
    });
  };

  const days: { key: DayOfWeek; label: string }[] = [
    { key: 'segunda', label: 'Segunda' },
    { key: 'terca', label: 'Terça' },
    { key: 'quarta', label: 'Quarta' },
    { key: 'quinta', label: 'Quinta' },
    { key: 'sexta', label: 'Sexta' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' },
  ];

  const inputClass = "w-full p-2 border border-bigYellow/50 bg-bigYellow/10 dark:bg-gray-700 dark:border-gray-600 rounded focus:ring-2 focus:ring-bigYellow focus:border-bigYellow outline-none text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-12">
      
      {/* SECTION 1: ADD/EDIT STAFF */}
      <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-bigRed dark:text-red-400 flex items-center gap-2">
                <UserPlus className="w-6 h-6" />
                Gerenciar Equipe
            </h2>
            {savedMessage && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-right-5">
                    <CheckCircle2 size={16} />
                    {savedMessage}
                </div>
            )}
          </div>

          {/* Form Card */}
          <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 transition-colors mb-8 ${editingId ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-bigRed'}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    {editingId ? <Pencil size={18} className="text-blue-500" /> : <UserPlus size={18} className="text-bigRed" />}
                    {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
                </h3>
                {editingId && (
                    <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 flex items-center gap-1">
                        <X size={16} /> Cancelar Edição
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nome Completo</label>
                <input
                type="text"
                className={inputClass}
                placeholder="Ex: João Silva"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Chave PIX</label>
                <input
                type="text"
                className={inputClass}
                placeholder="CPF/Email/Tel"
                value={newPix}
                onChange={(e) => setNewPix(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Telefone (WhatsApp)</label>
                <input
                type="text"
                className={inputClass}
                placeholder="(11) 99999-9999"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Função</label>
                <select
                className={inputClass}
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as StaffRole)}
                >
                <option value={StaffRole.MOTOBOY}>Motoboy</option>
                <option value={StaffRole.KITCHEN}>Cozinha</option>
                <option value={StaffRole.ATENDENTE}>Atendente</option>
                </select>
            </div>
            </div>
            <div className="flex gap-3 mt-4">
                <button
                onClick={handleSave}
                className={`px-6 py-2 rounded text-white transition-colors flex items-center gap-2 font-medium shadow-sm hover:shadow-md
                    ${editingId 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-bigRed hover:bg-red-800'
                    }`}
                >
                {editingId ? <Save size={18} /> : <UserPlus size={18} />}
                {editingId ? 'Salvar Alterações' : 'Adicionar Funcionário'}
                </button>
                
                {editingId && (
                    <button 
                        onClick={resetForm}
                        className="px-6 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
            </div>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.map((staff) => (
            <div key={staff.id} className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 flex justify-between items-start transition-all duration-300 ${editingId === staff.id ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900 scale-[1.02]' : 'border-bigYellow hover:shadow-lg'}`}>
                <div>
                <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <User size={16} className={editingId === staff.id ? "text-blue-500" : "text-bigRed dark:text-red-400"} />
                    {staff.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{staff.role}</p>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <div className="flex items-center gap-2">
                    <CreditCard size={14} />
                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded select-all">{staff.pixKey}</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span className="select-all">{staff.phone}</span>
                    </div>
                </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    <button
                    onClick={() => startEditing(staff)}
                    className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all p-2 rounded-full"
                    title="Editar Funcionário"
                    >
                    <Pencil size={18} />
                    </button>
                    <button
                    onClick={() => handleDelete(staff.id)}
                    className="text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all p-2 rounded-full"
                    title="Remover Funcionário"
                    >
                    <Trash2 size={18} />
                    </button>
                </div>
            </div>
            ))}

            {staffList.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                Nenhum funcionário cadastrado. Adicione acima.
            </p>
            )}
          </div>
      </section>

      {/* SECTION 2: SCHEDULE MANAGER */}
      <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-6">
             <h2 className="text-2xl font-bold text-bigRed dark:text-red-400 flex items-center gap-2 mb-2">
                <CalendarDays className="w-6 h-6" />
                Escala Padrão Semanal
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
                Defina quais funcionários fixos trabalham em cada dia da semana.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
             {/* Day Tabs */}
             <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-hide">
                {days.map((day) => {
                    const isActive = activeDay === day.key;
                    // Calculate count for this day
                    const count = schedule[day.key]?.length || 0;
                    
                    return (
                        <button
                            key={day.key}
                            onClick={() => setActiveDay(day.key)}
                            className={`flex-1 min-w-[100px] py-4 px-2 text-center transition-all relative
                                ${isActive 
                                    ? 'bg-bigRed/5 dark:bg-red-900/20 text-bigRed dark:text-red-400 font-bold' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium'
                                }
                            `}
                        >
                            <span className="block text-sm uppercase tracking-wider">{day.label}</span>
                            {count > 0 && (
                                <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full mt-1 
                                    ${isActive ? 'bg-bigRed text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                    {count}
                                </span>
                            )}
                            {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-bigRed dark:bg-red-500" />}
                        </button>
                    )
                })}
             </div>

             {/* Staff Selection Area */}
             <div className="p-6 bg-gray-50/50 dark:bg-gray-800/50">
                {staffList.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">Cadastre funcionários primeiro para montar a escala.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[StaffRole.MOTOBOY, StaffRole.KITCHEN, StaffRole.ATENDENTE].map(role => {
                            const staffInRole = staffList.filter(s => s.role === role);
                            if (staffInRole.length === 0) return null;

                            return (
                                <div key={role} className="space-y-3">
                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2 uppercase text-xs tracking-wide">
                                        {role}s
                                    </h4>
                                    <div className="space-y-2">
                                        {staffInRole.map(staff => {
                                            const isSelected = schedule[activeDay]?.includes(staff.id);
                                            return (
                                                <button
                                                    key={staff.id}
                                                    onClick={() => toggleStaffOnDay(staff.id)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 group
                                                        ${isSelected 
                                                            ? 'bg-white dark:bg-gray-700 border-bigYellow shadow-sm ring-1 ring-bigYellow' 
                                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 opacity-70 hover:opacity-100'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                            ${isSelected 
                                                                ? 'bg-bigYellow border-bigYellow text-white' 
                                                                : 'border-gray-300 dark:border-gray-500 group-hover:border-bigYellow'
                                                            }
                                                        `}>
                                                            {isSelected && <Check size={14} strokeWidth={3} />}
                                                        </div>
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {staff.name}
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
             </div>
             
             <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <p>Equipe para <span className="font-bold text-bigRed dark:text-red-400 uppercase">{days.find(d => d.key === activeDay)?.label}</span></p>
                <p>{schedule[activeDay]?.length || 0} funcionários escalados</p>
             </div>
          </div>
      </section>
    </div>
  );
};

export default StaffManager;