
import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import DailyClose from './components/DailyClose';
import StaffManager from './components/StaffManager';
import Reports from './components/Reports';
import { Pizza, DollarSign, Users, FileText, Menu, X, Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('closing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedClosingDate, setSelectedClosingDate] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleEditRecord = (date: string) => {
    setSelectedClosingDate(date);
    setCurrentView('closing');
  };

  const NavItem = ({ view, label, icon: Icon, onClick }: { view: ViewState; label: string; icon: any; onClick?: () => void }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setMobileMenuOpen(false);
        if (onClick) onClick();
      }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full md:w-auto transition-all duration-200
        ${currentView === view 
          ? 'bg-bigYellow text-white font-bold shadow-md' 
          : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <header className="bg-bigRed dark:bg-red-950 text-white shadow-lg sticky top-0 z-50 no-print transition-colors duration-300">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-full p-1.5 shadow-sm">
                <Pizza className="text-bigRed w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight leading-none text-white">Big Borda</h1>
                <span className="text-xs font-medium text-bigYellow tracking-widest uppercase">Gourmet</span>
              </div>
            </div>

            <nav className="hidden md:flex gap-2 items-center">
              <NavItem view="closing" label="Fechamento" icon={DollarSign} onClick={() => setSelectedClosingDate(null)} />
              <NavItem view="staff" label="Equipe" icon={Users} />
              <NavItem view="reports" label="Relatórios" icon={FileText} />
              <div className="w-px h-8 bg-white/20 mx-2"></div>
              <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-black/20 hover:bg-black/40 text-yellow-300 transition-colors"
                title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </nav>

            <div className="flex items-center gap-2 md:hidden">
               <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-black/20 text-yellow-300">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className="text-white p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-red-900 dark:bg-red-950 px-4 py-4 space-y-2 border-t border-red-800 dark:border-red-900">
            <NavItem view="closing" label="Fechamento do Dia" icon={DollarSign} onClick={() => setSelectedClosingDate(null)} />
            <NavItem view="staff" label="Gerenciar Equipe" icon={Users} />
            <NavItem view="reports" label="Imprimir Relatórios" icon={FileText} />
          </div>
        )}
      </header>

      <main className="flex-grow container mx-auto py-6">
        <div className={currentView === 'closing' ? 'block animate-in fade-in duration-300' : 'hidden'}>
          <DailyClose 
            isVisible={currentView === 'closing'} 
            initialDate={selectedClosingDate}
          />
        </div>
        <div className={currentView === 'staff' ? 'block animate-in fade-in duration-300' : 'hidden'}>
          <StaffManager />
        </div>
        <div className={currentView === 'reports' ? 'block animate-in fade-in duration-300' : 'hidden'}>
          <Reports isVisible={currentView === 'reports'} onEditRecord={handleEditRecord} />
        </div>
      </main>

      <footer className="bg-gray-800 dark:bg-black text-gray-400 py-6 text-center text-sm no-print">
        <p>&copy; {new Date().getFullYear()} Big Borda Gourmet. Sistema Financeiro by Gustavo Troffer.</p>
      </footer>
    </div>
  );
};

export default App;
