import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, CensusRecord, NewCensusRecord, ColumnMap } from '../types';
import { authService, censusService } from '../services/supabaseService';
import { dbService } from '../services/dbService';
import { exportToMultiSheetExcel, generateAdvancedPdf, readExcelFile } from '../utils/fileHandlers';
import { calculateAge, calculateDisplayGroup, GROUP_DEFINITIONS } from '../utils/helpers';
import MemberFormModal from './MemberFormModal';
import MappingModal from './MappingModal';
import Spinner from './Spinner';
import CensusSummaryModal, { CensusData } from './CensusSummaryModal';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';
type LoadingState = 'syncingData' | 'idle' | 'importing';
type StatusFilter = 'general' | 'archivado' | 'trasladado' | 'all';
type GenderFilter = 'All' | 'Masculino' | 'Femenino';

const StatusIndicator: React.FC<{ status: SyncStatus }> = ({ status }) => {
    const statusInfo = {
        online: { text: 'En línea', color: 'bg-green-500' },
        offline: { text: 'Modo Offline', color: 'bg-yellow-500' },
        syncing: { text: 'Sincronizando...', color: 'bg-blue-500' },
        error: { text: 'Error de Sincronización', color: 'bg-red-500' },
    };
    const { text, color } = statusInfo[status];
    return (
        <div className="flex items-center space-x-2">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`}></div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{text}</span>
        </div>
    );
};

const getStatusClass = (status: CensusRecord['estado']) => {
    switch (status) {
        case 'Activo':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'Retirado Temporal':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case 'Archivado':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
        case 'Trasladado':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
    }
};


const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [records, setRecords] = useState<CensusRecord[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('syncingData');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCensusModalOpen, setIsCensusModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CensusRecord | null>(null);
  
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterGender, setFilterGender] = useState<GenderFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);

  const [selectedRecordForSummary, setSelectedRecordForSummary] = useState<CensusRecord | null>(null);
  
  // Predictive Search State
  const [suggestions, setSuggestions] = useState<CensusRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);


  const churchName = user.church_name;

  const syncData = useCallback(async () => {
    setLoadingState('syncingData');
    if (!navigator.onLine) {
      setSyncStatus('offline');
      console.log('Offline: Loading data from IndexedDB.');
      const localRecords = await dbService.getAllRecords();
      setRecords(localRecords);
      setLoadingState('idle');
      return;
    }

    try {
      setSyncStatus('syncing');
      const syncQueue = await dbService.getSyncQueue();
      if (syncQueue.length > 0) {
        console.log(`Processing ${syncQueue.length} items from sync queue.`);
        for (const op of syncQueue) {
          switch (op.type) {
            case 'CREATE':
              await censusService.createRecord(op.payload as NewCensusRecord);
              break;
            case 'UPDATE':
              await censusService.updateRecord(op.payload as CensusRecord);
              break;
            case 'DELETE':
              await censusService.deleteRecord(op.payload.id);
              break;
          }
          await dbService.removeSyncOperation(op.id!);
        }
      }

      console.log('Fetching fresh data from server...');
      const serverRecords = await censusService.getRecords();
      setRecords(serverRecords);
      await dbService.clearAndBulkInsertRecords(serverRecords);
      setSyncStatus('online');
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      const localRecords = await dbService.getAllRecords();
      setRecords(localRecords);
    } finally {
      setLoadingState('idle');
    }
  }, []);
  
  useEffect(() => {
    syncData();
    
    window.addEventListener('online', syncData);
    window.addEventListener('offline', () => setSyncStatus('offline'));

    return () => {
      window.removeEventListener('online', syncData);
      window.removeEventListener('offline', () => setSyncStatus('offline'));
    };
  }, [syncData]);

  const handleCreateOrUpdate = async (recordData: NewCensusRecord | CensusRecord) => {
    if ('id' in recordData && recordData.id) { // Update
      const updatedRecord = recordData as CensusRecord;
      if (navigator.onLine) {
        try {
          const result = await censusService.updateRecord(updatedRecord);
          const updatedRecords = records.map(r => r.id === result.id ? result : r);
          setRecords(updatedRecords);
          await dbService.clearAndBulkInsertRecords(updatedRecords);
        } catch (e) {
            await dbService.addSyncOperation({ type: 'UPDATE', payload: updatedRecord, timestamp: Date.now() });
            setRecords(records.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        }
      } else {
        await dbService.addSyncOperation({ type: 'UPDATE', payload: updatedRecord, timestamp: Date.now() });
        setRecords(records.map(r => r.id === updatedRecord.id ? updatedRecord : r));
      }
    } else { // Create
      const newRecordData = recordData as NewCensusRecord;
      if (navigator.onLine) {
          try {
            const newRecord = await censusService.createRecord(newRecordData);
            const newRecords = [...records, newRecord];
            setRecords(newRecords);
            await dbService.clearAndBulkInsertRecords(newRecords);
          } catch(e) {
            const tempId = -Date.now(); // Temporary negative ID for offline
            const payload = { ...newRecordData, id: tempId, user_id: user.id };
            await dbService.addSyncOperation({ type: 'CREATE', payload: payload, timestamp: Date.now() });
            setRecords([...records, payload]);
          }
      } else {
        const tempId = -Date.now();
        const payload = { ...newRecordData, id: tempId, user_id: user.id };
        await dbService.addSyncOperation({ type: 'CREATE', payload: payload, timestamp: Date.now() });
        setRecords([...records, payload]);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (navigator.onLine) {
        try {
            await censusService.deleteRecord(id);
            const newRecords = records.filter(r => r.id !== id);
            setRecords(newRecords);
            await dbService.clearAndBulkInsertRecords(newRecords);
        } catch(e) {
            await dbService.addSyncOperation({ type: 'DELETE', payload: { id }, timestamp: Date.now() });
            setRecords(records.filter(r => r.id !== id));
        }
    } else {
      await dbService.addSyncOperation({ type: 'DELETE', payload: { id }, timestamp: Date.now() });
      setRecords(records.filter(r => r.id !== id));
    }
  };

  const handleImportClick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setLoadingState('importing');
        const { headers, data } = await readExcelFile(file);
        setExcelHeaders(headers);
        setExcelData(data);
        setIsMappingModalOpen(true);
      } catch (error) {
        alert((error as Error).message);
      } finally {
        setLoadingState('idle');
        e.target.value = '';
      }
    }
  };

  const handleConfirmImport = async (columnMap: ColumnMap) => {
    setLoadingState('importing');
    
    const existingNames = new Set(records.map(r => r.nombre_completo.toLowerCase().trim()));
    const newRecords: NewCensusRecord[] = [];
    let skippedCount = 0;
    const namesInThisImport = new Set<string>();

    const formatDateForSupabase = (date: Date): string => {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().split('T')[0];
    };

    for (const [index, row] of excelData.entries()) {
        try {
            const nombre_completo_raw = row[columnMap.nombre_completo];
            if (!nombre_completo_raw || String(nombre_completo_raw).trim() === '') {
                continue;
            }
            
            const nombre_completo = String(nombre_completo_raw).trim();
            const normalizedName = nombre_completo.toLowerCase();

            if (existingNames.has(normalizedName) || namesInThisImport.has(normalizedName)) {
                skippedCount++;
                continue;
            }
            namesInThisImport.add(normalizedName);

            let fecha_nacimiento: string | undefined = undefined;
            if (columnMap.fecha_nacimiento && row[columnMap.fecha_nacimiento]) {
                const dateValue = row[columnMap.fecha_nacimiento];
                if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
                    fecha_nacimiento = formatDateForSupabase(dateValue);
                }
            }

            if (!fecha_nacimiento && columnMap.anio && columnMap.mes && columnMap.dia) {
                const year = parseInt(row[columnMap.anio], 10);
                const month = parseInt(row[columnMap.mes], 10);
                const day = parseInt(row[columnMap.dia], 10);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    fecha_nacimiento = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            
            let estado: CensusRecord['estado'] = 'Activo';
            if (columnMap.estado_rt && String(row[columnMap.estado_rt] || '').trim().toUpperCase() === 'X') {
                estado = 'Retirado Temporal';
            } else if (columnMap.estado_ma && (String(row[columnMap.estado_ma] || '').trim().toUpperCase() === 'X' || String(row[columnMap.estado_ma] || '').trim().toUpperCase() === 'M.A')) {
                estado = 'Archivado';
            } else if (columnMap.estado_t && (String(row[columnMap.estado_t] || '').trim().toUpperCase() === 'X' || String(row[columnMap.estado_t] || '').trim().toUpperCase() === 'T')) {
                estado = 'Trasladado';
            } else if (columnMap.estado_act && String(row[columnMap.estado_act] || '').trim().toUpperCase() === 'X') {
                estado = 'Activo';
            }

            const generoValue = String(row[columnMap.genero] || '').toLowerCase();
            let genero: 'Masculino' | 'Femenino' | undefined;
            if (generoValue.startsWith('m')) genero = 'Masculino';
            else if (generoValue.startsWith('f') || generoValue.startsWith('w')) genero = 'Femenino';

            const record: NewCensusRecord = {
                nombre_completo,
                numero_cedula: row[columnMap.numero_cedula] ? String(row[columnMap.numero_cedula]) : undefined,
                fecha_nacimiento,
                genero,
                grupo: row[columnMap.grupo] ? String(row[columnMap.grupo]) as any : undefined,
                estado
            };
            newRecords.push(record);

        } catch (error: any) {
            alert(`Error procesando la fila ${index + 2} del archivo Excel. Por favor, revise los datos en esa fila.\n\nDetalle del error: ${error.message}`);
            setLoadingState('idle');
            setIsMappingModalOpen(false);
            return;
        }
    }

    if (newRecords.length > 0) {
        if (navigator.onLine) {
            try {
                await censusService.bulkCreateRecords(newRecords);
                alert(`${newRecords.length} registros han sido importados exitosamente.${skippedCount > 0 ? ` ${skippedCount} duplicados fueron omitidos.` : ''}`);
                await syncData();
            } catch(e: any) {
                 alert(`Error al guardar los registros en la base de datos: ${e.message}`);
            }
        } else {
            alert("La importación masiva solo está disponible en línea.");
        }
    } else {
        alert(`No se encontraron registros nuevos para importar.${skippedCount > 0 ? ` ${skippedCount} duplicados fueron omitidos.` : ''}`);
    }
    
    setIsMappingModalOpen(false);
    setLoadingState('idle');
  };
  
  const handleOpenMemberSummary = (record: CensusRecord) => {
    setSelectedRecordForSummary(record);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const newSuggestions = records.filter(r => 
        r.nombre_completo.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setSearchTerm(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };


  const censusData = useMemo<CensusData>(() => {
    const adultGroups: { [key: string]: { H: number; M: number } } = {
      'CG': { H: 0, M: 0 }, 'CM': { H: 0, M: 0 }, 'CC': { H: 0, M: 0 },
      'S': { H: 0, M: 0 }, 'J': { H: 0, M: 0 },
    };

    const data: CensusData = {
      groups: adultGroups,
      adultSubtotal: { H: 0, M: 0 },
      children: { H: 0, M: 0 },
      total: { H: 0, M: 0 },
    };

    const activeRecords = records.filter(r => r.estado === 'Activo' || r.estado === 'Retirado Temporal');

    for (const record of activeRecords) {
      const group = calculateDisplayGroup(record);
      const gender = record.genero === 'Masculino' ? 'H' : 'M';

      if (group === 'N') {
        data.children[gender]++;
      } else if (data.groups[group as keyof typeof adultGroups]) {
        data.groups[group as keyof typeof adultGroups][gender]++;
      }
    }

    Object.values(data.groups).forEach(groupCount => {
      data.adultSubtotal.H += groupCount.H;
      data.adultSubtotal.M += groupCount.M;
    });

    data.total.H = data.adultSubtotal.H + data.children.H;
    data.total.M = data.adultSubtotal.M + data.children.M;

    return data;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        switch(filterStatus) {
            case 'general':
                return r.estado === 'Activo' || r.estado === 'Retirado Temporal';
            case 'archivado':
                return r.estado === 'Archivado';
            case 'trasladado':
                return r.estado === 'Trasladado';
            case 'all':
            default:
                return true;
        }
      })
      .filter(r => {
        if (filterGroup === 'All') return true;
        return calculateDisplayGroup(r) === filterGroup;
      })
      .filter(r => {
        if (filterGender === 'All') return true;
        return r.genero === filterGender;
      })
      .filter(r => r.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [records, filterGroup, searchTerm, filterStatus, filterGender]);

  if (loadingState === 'syncingData') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center space-x-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">{churchName}</h1>
            <StatusIndicator status={syncStatus} />
        </div>
        <div className="flex items-center space-x-2">
          <button 
              onClick={() => { setEditingRecord(null); setIsFormOpen(true); }}
              className="h-10 w-10 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800"
              aria-label="Agregar miembro"
              title="Agregar Miembro"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
          
          <button 
              onClick={() => authService.signOut()} 
              className="h-10 w-10 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-800"
              aria-label="Cerrar sesión"
              title="Cerrar Sesión"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
          </button>
        </div>
      </header>
      
      <main className="p-4 md:p-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 space-y-4">
            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => setIsCensusModalOpen(true)} className="flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 transition-colors">
                    <span>Censo</span>
                </button>
                <label htmlFor="import-excel" className="flex items-center justify-center gap-2 bg-green-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-600 transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    <span>Cargar</span>
                </label>
                <input id="import-excel" type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportClick} />
                <button onClick={() => exportToMultiSheetExcel(records, churchName)} className="flex items-center justify-center gap-2 bg-green-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    <span>Excel</span>
                </button>
                <button onClick={() => generateAdvancedPdf(records, churchName)} className="flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    <span>PDF</span>
                </button>
            </div>

             {/* Collapsible Filters */}
            <div>
              <button
                onClick={() => setAreFiltersVisible(!areFiltersVisible)}
                className="w-full flex justify-between items-center text-left p-3 mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-expanded={areFiltersVisible}
                aria-controls="filter-section"
              >
                <div className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                    </svg>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">Filtros y Búsqueda</span>
                </div>
                <svg className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform transform ${areFiltersVisible ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <div id="filter-section" className={`transition-all duration-300 ease-in-out overflow-hidden ${areFiltersVisible ? 'max-h-96' : 'max-h-0'}`}>
                <div className="space-y-4 pt-4">
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                      </div>
                      <input
                          type="text"
                          placeholder="Buscar por nombre..."
                          value={searchTerm}
                          onChange={handleSearchChange}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoComplete="off"
                      />
                      {showSuggestions && suggestions.length > 0 && searchTerm && (
                          <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {suggestions.map(suggestion => (
                                  <li 
                                      key={suggestion.id}
                                      className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                                      onMouseDown={() => handleSuggestionClick(suggestion.nombre_completo)}
                                  >
                                      {suggestion.nombre_completo}
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                          <select
                              value={filterStatus}
                              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                              className="w-full appearance-none pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              <option value="all">Todos los Registros</option>
                              <option value="general">Censo General (Activos/RT)</option>
                              <option value="archivado">Archivados</option>
                              <option value="trasladado">Trasladados</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </div>
                      </div>
                      <div className="relative">
                          <select
                              value={filterGroup}
                              onChange={(e) => setFilterGroup(e.target.value)}
                              className="w-full appearance-none pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              <option value="All">Todos los Grupos</option>
                              {Object.entries(GROUP_DEFINITIONS).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                              ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </div>
                      </div>
                       <div className="relative">
                          <select
                              value={filterGender}
                              onChange={(e) => setFilterGender(e.target.value as GenderFilter)}
                              className="w-full appearance-none pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              <option value="All">Todos los Géneros</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Femenino">Femenino</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            {/* Header */}
            <div className="hidden md:flex px-6 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <div className="flex-1">Nombre</div>
                <div className="w-20 text-center">Edad</div>
                <div className="w-24 text-center">Cédula</div>
                <div className="w-24 text-center">Grupo</div>
                <div className="w-40 text-center">Estado</div>
                <div className="w-24 text-right">Acciones</div>
            </div>
            {/* Body */}
            <div>
                {filteredRecords.map(record => (
                    <div key={record.id} className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 flex-wrap">
                        <div className="flex-1 font-medium text-gray-900 dark:text-white whitespace-nowrap truncate pr-4 min-w-[150px] w-full md:w-auto mb-2 md:mb-0">{record.nombre_completo}</div>
                        <div className="w-1/2 md:w-20 text-left md:text-center text-sm text-gray-500 dark:text-gray-400"><span className="md:hidden font-bold text-gray-600 dark:text-gray-300">Edad: </span>{calculateAge(record.fecha_nacimiento)}</div>
                        <div className="w-1/2 md:w-24 text-left md:text-center text-xl" title={record.numero_cedula || 'Sin Cédula'}>
                            <span className="md:hidden font-bold text-gray-600 dark:text-gray-300 text-sm">Cédula: </span>
                            {record.numero_cedula ? '✔️' : <span className="text-red-400">❌</span>}
                        </div>
                        <div className="w-1/2 md:w-24 text-left md:text-center text-sm text-gray-500 dark:text-gray-400 truncate">
                           <span className="md:hidden font-bold text-gray-600 dark:text-gray-300">Grupo: </span>{calculateDisplayGroup(record)}
                        </div>
                        <div className="w-1/2 md:w-40 text-left md:text-center">
                            <span className="md:hidden font-bold text-gray-600 dark:text-gray-300 text-sm">Estado: </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(record.estado)}`}>
                                {record.estado}
                            </span>
                        </div>
                        <div className="w-full md:w-24 flex items-center justify-end space-x-1 md:space-x-2 mt-2 md:mt-0">
                             <button onClick={() => handleOpenMemberSummary(record)} className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="Ver resumen" title="Ver Resumen">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                            <button onClick={() => { setEditingRecord(record); setIsFormOpen(true); }} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="Editar miembro" title="Editar">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                              </svg>
                            </button>
                        </div>
                    </div>
                ))}
                {filteredRecords.length === 0 && (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white">No se encontraron resultados</h3>
                    {searchTerm ? (
                      <p className="mt-1 text-sm">No pudimos encontrar ningún miembro que coincida con "<span className="font-semibold text-gray-600 dark:text-gray-200">{searchTerm}</span>".</p>
                    ) : (
                      <p className="mt-1 text-sm">No hay miembros que coincidan con los filtros actuales.</p>
                    )}
                  </div>
                )}
            </div>
        </div>
      </main>

      <MemberFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSubmit={handleCreateOrUpdate} 
        initialData={editingRecord}
        onDelete={handleDelete}
      />

      <MappingModal 
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        headers={excelHeaders}
        onConfirm={handleConfirmImport}
      />
      
      <CensusSummaryModal
        isOpen={isCensusModalOpen}
        onClose={() => setIsCensusModalOpen(false)}
        censusData={censusData}
        churchName={churchName}
      />

       {selectedRecordForSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setSelectedRecordForSummary(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Resumen del Miembro</h3>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Nombre Completo:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{selectedRecordForSummary.nombre_completo}</p>
                    </div>
                     <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Género:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{selectedRecordForSummary.genero || 'No especificado'}</p>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Fecha de Nacimiento:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{selectedRecordForSummary.fecha_nacimiento ? new Date(selectedRecordForSummary.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificada'}</p>
                    </div>
                     <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Edad:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{calculateAge(selectedRecordForSummary.fecha_nacimiento)} años</p>
                    </div>
                     <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Número de Cédula:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{selectedRecordForSummary.numero_cedula || 'No registrada'}</p>
                    </div>
                     <div>
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Grupo:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{GROUP_DEFINITIONS[selectedRecordForSummary.grupo as keyof typeof GROUP_DEFINITIONS] || selectedRecordForSummary.grupo || 'No asignado'}</p>
                    </div>
                    <div className="sm:col-span-2">
                        <span className="font-semibold text-gray-500 dark:text-gray-400 block">Estado:</span>
                        <p className="mt-1"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(selectedRecordForSummary.estado)}`}>
                                {selectedRecordForSummary.estado}
                            </span></p>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedRecordForSummary(null)} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;