import React, { useState, useEffect } from 'react';
import type { ColumnMap } from '../types';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  onConfirm: (columnMap: ColumnMap) => void;
}

const APP_FIELDS = [
    { key: 'nombre_completo', label: 'Nombre Completo', required: true, keywords: ['nombre', 'completo'] },
    { key: 'dia', label: 'Día de Nacimiento', required: false, keywords: ['dia', 'dã­a'] },
    { key: 'mes', label: 'Mes de Nacimiento', required: false, keywords: ['mes'] },
    { key: 'anio', label: 'Año de Nacimiento', required: false, keywords: ['ano', 'año'] },
    { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento (Completa)', required: false, keywords: ['fecha', 'nacimiento'] },
    { key: 'numero_cedula', label: 'Número de Cédula', required: false, keywords: ['cedula', 'cã©dula'] },
    { key: 'genero', label: 'Género', required: false, keywords: ['genero', 'gã©nero', 'sexo'] },
    { key: 'grupo', label: 'Grupo', required: false, keywords: ['grupo'] },
    { key: 'estado_act', label: 'Estado (Columna "ACT")', required: false, keywords: ['act'] },
    { key: 'estado_rt', label: 'Estado (Columna "RT")', required: false, keywords: ['rt'] },
    { key: 'estado_ma', label: 'Estado (Columna "M.A")', required: false, keywords: ['m.a', 'ma', 'archivado'] },
    { key: 'estado_t', label: 'Estado (Columna "T")', required: false, keywords: ['t', 'traslado'] },
];

const normalizeStr = (s: string) => (s || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const MappingModal: React.FC<MappingModalProps> = ({ isOpen, onClose, headers, onConfirm }) => {
  const [columnMap, setColumnMap] = useState<ColumnMap>({});

  useEffect(() => {
    if (isOpen) {
      const initialMap: ColumnMap = {};
      const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeStr(h) }));

      APP_FIELDS.forEach(field => {
        // Pass 1: Try to find a header that contains all keywords for the field
        let bestMatch = normalizedHeaders.find(h => field.keywords.every(kw => h.normalized.includes(kw)));
        
        // Pass 2: If no perfect match, find a header that contains at least one keyword
        if (!bestMatch) {
            bestMatch = normalizedHeaders.find(h => field.keywords.some(kw => h.normalized.includes(kw)));
        }

        if (bestMatch) {
          initialMap[field.key] = bestMatch.original;
        }
      });
      setColumnMap(initialMap);
    }
  }, [isOpen, headers]);


  if (!isOpen) return null;

  const handleSelectChange = (appFieldKey: string, excelHeader: string) => {
    setColumnMap(prev => ({ ...prev, [appFieldKey]: excelHeader }));
  };

  const handleConfirm = () => {
    if (!columnMap['nombre_completo']) {
        alert('Por favor, asigne una columna para "Nombre Completo".');
        return;
    }
    onConfirm(columnMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Asistente de Importación</h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          Asigna las columnas de tu archivo Excel a los campos requeridos por la aplicación.
        </p>
        <div className="flex-grow overflow-y-auto pr-2">
            <div className="space-y-4">
            {APP_FIELDS.map(field => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        value={columnMap[field.key] || ''}
                        onChange={(e) => handleSelectChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- No importar --</option>
                        {headers.map(header => (
                            <option key={header} value={header}>{header}</option>
                        ))}
                    </select>
                </div>
            ))}
            </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Confirmar Importación
          </button>
        </div>
      </div>
    </div>
  );
};

export default MappingModal;
