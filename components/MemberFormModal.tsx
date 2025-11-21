import React, { useState, useEffect } from 'react';
import type { CensusRecord, NewCensusRecord } from '../types';
import { GROUP_DEFINITIONS } from '../utils/helpers';
import ConfirmationModal from './ConfirmationModal';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: NewCensusRecord | CensusRecord) => void;
  initialData?: CensusRecord | null;
  onDelete?: (id: number) => void;
}

const MemberFormModal: React.FC<MemberFormModalProps> = ({ isOpen, onClose, onSubmit, initialData, onDelete }) => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [numeroCedula, setNumeroCedula] = useState('');
  const [genero, setGenero] = useState<'Masculino' | 'Femenino'>('Masculino');
  const [grupo, setGrupo] = useState<NonNullable<CensusRecord['grupo']>>('C');
  const [estado, setEstado] = useState<CensusRecord['estado']>('Activo');
  
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNombreCompleto(initialData.nombre_completo || '');
        setNumeroCedula(initialData.numero_cedula || '');
        setGenero(initialData.genero || 'Masculino');
        setGrupo(initialData.grupo || 'C');
        setEstado(initialData.estado || 'Activo');

        if (initialData.fecha_nacimiento) {
          const [y, m, d] = initialData.fecha_nacimiento.split('T')[0].split('-');
          setYear(y);
          setMonth(String(parseInt(m, 10)));
          setDay(String(parseInt(d, 10)));
        } else {
            setDay(''); setMonth(''); setYear('');
        }
      } else {
        setNombreCompleto('');
        setNumeroCedula('');
        setGenero('Masculino');
        setGrupo('C');
        setEstado('Activo');
        setDay('');
        setMonth('');
        setYear('');
      }
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fecha_nacimiento = year && month && day 
      ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : undefined;

    const recordData = {
        nombre_completo: nombreCompleto,
        fecha_nacimiento: fecha_nacimiento,
        numero_cedula: numeroCedula,
        genero: genero,
        grupo: grupo,
        estado: estado,
    };
    
    if (initialData?.id) {
        onSubmit({ ...initialData, ...recordData });
    } else {
        onSubmit(recordData);
    }
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
      { value: 1, name: 'Enero' }, { value: 2, name: 'Febrero' }, { value: 3, name: 'Marzo' },
      { value: 4, name: 'Abril' }, { value: 5, name: 'Mayo' }, { value: 6, name: 'Junio' },
      { value: 7, name: 'Julio' }, { value: 8, name: 'Agosto' }, { value: 9, name: 'Septiembre' },
      { value: 10, name: 'Octubre' }, { value: 11, name: 'Noviembre' }, { value: 12, name: 'Diciembre' }
  ];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);


  return (
    <>
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 transition-opacity" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{initialData ? 'Editar Miembro' : 'Nuevo Registro'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Complete la información del censo</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            <div>
                <label htmlFor="nombre_completo" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Nombre Completo</label>
                <input type="text" name="nombre_completo" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required className="block w-full px-4 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 transition-all"/>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Fecha de Nacimiento</label>
                <div className="grid grid-cols-3 gap-3">
                    <div className="relative">
                        <select name="day" value={day} onChange={(e) => setDay(e.target.value)} className="block w-full px-3 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white transition-all">
                            <option value="">Día</option>
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div className="absolute right-2 top-4 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                    </div>
                    <div className="relative">
                        <select name="month" value={month} onChange={(e) => setMonth(e.target.value)} className="block w-full px-3 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white transition-all">
                            <option value="">Mes</option>
                            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                        </select>
                        <div className="absolute right-2 top-4 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                    </div>
                    <div className="relative">
                        <select name="year" value={year} onChange={(e) => setYear(e.target.value)} className="block w-full px-3 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white transition-all">
                            <option value="">Año</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="absolute right-2 top-4 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="numero_cedula" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Número de Cédula</label>
                <input type="text" name="numero_cedula" value={numeroCedula} onChange={(e) => setNumeroCedula(e.target.value)} className="block w-full px-4 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 transition-all" placeholder="000-000000-0000A"/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                <label htmlFor="genero" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Género</label>
                <div className="relative">
                    <select name="genero" value={genero} onChange={(e) => setGenero(e.target.value as any)} className="block w-full px-4 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-slate-900 dark:text-white transition-all">
                        <option>Masculino</option>
                        <option>Femenino</option>
                    </select>
                    <div className="absolute right-3 top-4 pointer-events-none text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                </div>
                </div>
                <div>
                <label htmlFor="grupo" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Grupo</label>
                <div className="relative">
                    <select name="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value as NonNullable<CensusRecord['grupo']>)} className="block w-full px-4 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-slate-900 dark:text-white transition-all">
                        {Object.entries(GROUP_DEFINITIONS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-4 pointer-events-none text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                </div>
                </div>
            </div>

            <div>
                <label htmlFor="estado" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Estado</label>
                <div className="relative">
                    <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value as any)} className="block w-full px-4 py-3.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-slate-900 dark:text-white transition-all">
                        <option value="Activo">Activo</option>
                        <option value="Retirado Temporal">Retirado Temporal</option>
                        <option value="Archivado">Archivado</option>
                        <option value="Trasladado">Trasladado</option>
                    </select>
                    <div className="absolute right-3 top-4 pointer-events-none text-slate-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center pt-8 mt-2 border-t border-slate-100 dark:border-slate-700 gap-4">
                {initialData && onDelete ? (
                    <button 
                        type="button" 
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="w-full sm:w-auto px-4 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    >
                        Eliminar Miembro
                    </button>
                ) : <div className="hidden sm:block"></div>}
                
                <div className="flex w-full sm:w-auto space-x-3">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" className="flex-1 sm:flex-none px-8 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all active:scale-95">
                        Guardar
                    </button>
                </div>
            </div>
            </form>
        </div>
      </div>
    </div>
    <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
            if (initialData?.id && onDelete) {
                onDelete(initialData.id);
            }
            setConfirmDeleteOpen(false);
            onClose(); 
        }}
        title="Eliminar Miembro"
        message="¿Estás seguro de que quieres eliminar este registro permanentemente? Esta acción no se puede deshacer."
      />
    </>
  );
};

export default MemberFormModal;