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
  
  // State for separate date fields
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
        // Reset form for new entry
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 m-4 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Editar Miembro' : 'Agregar Nuevo Miembro'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nombre_completo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Completo</label>
            <input type="text" name="nombre_completo" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          
          {/* --- START: REDESIGNED DATE INPUT --- */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Nacimiento</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <select name="day" value={day} onChange={(e) => setDay(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                <option value="">Día</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select name="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                 <option value="">Mes</option>
                 {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
              </select>
              <select name="year" value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                 <option value="">Año</option>
                 {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          {/* --- END: REDESIGNED DATE INPUT --- */}

          <div>
            <label htmlFor="numero_cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número de Cédula</label>
            <input type="text" name="numero_cedula" value={numeroCedula} onChange={(e) => setNumeroCedula(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="genero" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Género</label>
              <select name="genero" value={genero} onChange={(e) => setGenero(e.target.value as any)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option>Masculino</option>
                <option>Femenino</option>
              </select>
            </div>
            <div>
              <label htmlFor="grupo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grupo</label>
              <select name="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value as NonNullable<CensusRecord['grupo']>)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                {Object.entries(GROUP_DEFINITIONS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
           <div>
              <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
              <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value as any)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="Activo">Activo</option>
                <option value="Retirado Temporal">Retirado Temporal</option>
                <option value="Archivado">Archivado</option>
                <option value="Trasladado">Trasladado</option>
              </select>
            </div>
          <div className="flex justify-between items-center pt-4">
            <div>
                {initialData && onDelete && (
                    <button 
                        type="button" 
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                    >
                        Eliminar
                    </button>
                )}
            </div>
            <div className="space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Guardar</button>
            </div>
          </div>
        </form>
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
            onClose(); // Close the edit form as well
        }}
        title="Confirmar Eliminación"
        message="¿Estás seguro de que quieres eliminar este miembro? Esta acción es permanente."
      />
    </>
  );
};

export default MemberFormModal;
