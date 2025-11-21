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
        online: { text: 'En línea', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
        offline: { text: 'Offline', color: 'bg-amber-500', ring: 'ring-amber-500/30' },
        syncing: { text: 'Sincronizando...', color: 'bg-blue-500', ring: 'ring-blue-500/30' },
        error: { text: 'Error', color: 'bg-red-500', ring: 'ring-red-500/30' },
    };
    const { text, color } = statusInfo[status];
    return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className={`relative flex h-2.5 w-2.5`}>
              {status === 'syncing' && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`}></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`}></span>
            </span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600 dark:text-slate-300">{text}</span>
        </div>
    );
};

const getStatusClass = (status: CensusRecord['estado']) => {
    switch (status) {
        case 'Activo':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20';
        case 'Retirado Temporal':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20';
        case 'Archivado':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
        case 'Trasladado':
            return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20';
        default:
            return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
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
  
  const [suggestions, setSuggestions] = useState<CensusRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);

  const churchName = user.church_name;

  const syncData = useCallback(async () => {
    setLoadingState('syncingData');
    if (!navigator.onLine) {
      setSyncStatus('offline');
      const localRecords = await dbService.getAllRecords();
      setRecords(localRecords);
      setLoadingState('idle');
      return;
    }

    try {
      setSyncStatus('syncing');
      const syncQueue = await dbService.getSyncQueue();
      if (syncQueue.length > 0) {
        for (const op of syncQueue) {
          switch (op.type) {
            case 'CREATE': await censusService.createRecord(op.payload as NewCensusRecord); break;
            case 'UPDATE': await censusService.updateRecord(op.payload as CensusRecord); break;
            case 'DELETE': await censusService.deleteRecord(op.payload.id); break;
          }
          await dbService.removeSyncOperation(op.id!);
        }
      }

      const serverRecords = await censusService.getRecords();
      setRecords(serverRecords);
      await dbService.clearAndBulkInsertRecords(serverRecords);
      setSyncStatus('online');
    } catch (error) {
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
    const namesInThisImport = new Set<string>();
    let skippedCount = 0;

    const formatDateForSupabase = (date: Date): string => {
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().split('T')[0];
    };

    for (const [index, row] of excelData.entries()) {
        try {
            const nombre_completo_raw = row[columnMap.nombre_completo];
            if (!nombre_completo_raw || String(nombre_completo_raw).trim() === '') continue;
            
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
            if (columnMap.estado_rt && String(row[columnMap.estado_rt] || '').trim().toUpperCase() === 'X') estado = 'Retirado Temporal';
            else if (columnMap.estado_ma && (String(row[columnMap.estado_ma] || '').trim().toUpperCase() === 'X' || String(row[columnMap.estado_ma] || '').trim().toUpperCase() === 'M.A')) estado = 'Archivado';
            else if (columnMap.estado_t && (String(row[columnMap.estado_t] || '').trim().toUpperCase() === 'X' || String(row[columnMap.estado_t] || '').trim().toUpperCase() === 'T')) estado = 'Trasladado';
            else if (columnMap.estado_act && String(row[columnMap.estado_act] || '').trim().toUpperCase() === 'X') estado = 'Activo';

            const generoValue = String(row[columnMap.genero] || '').toLowerCase();
            let genero: 'Masculino' | 'Femenino' | undefined;
            if (generoValue.startsWith('m')) genero = 'Masculino';
            else if (generoValue.startsWith('f') || generoValue.startsWith('w')) genero = 'Femenino';

            newRecords.push({
                nombre_completo,
                numero_cedula: row[columnMap.numero_cedula] ? String(row[columnMap.numero_cedula]) : undefined,
                fecha_nacimiento,
                genero,
                grupo: row[columnMap.grupo] ? String(row[columnMap.grupo]) as any : undefined,
                estado
            });

        } catch (error: any) {
            alert(`Error en fila ${index + 2}: ${error.message}`);
            setLoadingState('idle');
            setIsMappingModalOpen(false);
            return;
        }
    }

    if (newRecords.length > 0) {
        if (navigator.onLine) {
            try {
                await censusService.bulkCreateRecords(newRecords);
                alert(`${newRecords.length} importados.${skippedCount > 0 ? ` ${skippedCount} omitidos.` : ''}`);
                await syncData();
            } catch(e: any) { alert(`Error BD: ${e.message}`); }
        } else { alert("Importación masiva requiere conexión."); }
    } else { alert(`Sin registros nuevos.${skippedCount > 0 ? ` ${skippedCount} duplicados.` : ''}`); }
    setIsMappingModalOpen(false);
    setLoadingState('idle');
  };
  
  const handleOpenMemberSummary = (record: CensusRecord) => setSelectedRecordForSummary(record);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const newSuggestions = records.filter(r => r.nombre_completo.toLowerCase().includes(value.toLowerCase()));
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
      if (group === 'N') data.children[gender]++;
      else if (data.groups[group as keyof typeof adultGroups]) data.groups[group as keyof typeof adultGroups][gender]++;
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
            case 'general': return r.estado === 'Activo' || r.estado === 'Retirado Temporal';
            case 'archivado': return r.estado === 'Archivado';
            case 'trasladado': return r.estado === 'Trasladado';
            case 'all': default: return true;
        }
      })
      .filter(r => filterGroup === 'All' ? true : calculateDisplayGroup(r) === filterGroup)
      .filter(r => filterGender === 'All' ? true : r.genero === filterGender)
      .filter(r => r.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [records, filterGroup, searchTerm, filterStatus, filterGender]);

  if (loadingState === 'syncingData') {
    return <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950"><Spinner size="h-16 w-16 text-indigo-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
            <div className="flex items-center gap-3 overflow-hidden">
                 <div className="h-9 w-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                 </div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white truncate tracking-tight">{churchName}</h1>
                <StatusIndicator status={syncStatus} />
            </div>
            <div className="flex items-center space-x-3">
              <button 
                  onClick={() => { setEditingRecord(null); setIsFormOpen(true); }}
                  className="h-10 w-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  title="Agregar Miembro"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
              <button 
                  onClick={() => authService.signOut()} 
                  className="h-10 w-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                  title="Cerrar Sesión"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Control Panel */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 mb-8 space-y-6">
            
            {/* Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button onClick={() => setIsCensusModalOpen(true)} className="group flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 py-3.5 px-4 rounded-xl hover:border-violet-400 dark:hover:border-violet-500 transition-all shadow-sm hover:shadow-md">
                    <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg group-hover:bg-violet-100 dark:group-hover:bg-violet-900/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Estadística</span>
                </button>
                
                <label htmlFor="import-excel" className="group flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 py-3.5 px-4 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-500 transition-all shadow-sm hover:shadow-md cursor-pointer">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Importar</span>
                </label>
                <input id="import-excel" type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportClick} />
                
                <button onClick={() => exportToMultiSheetExcel(records, churchName)} className="group flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 py-3.5 px-4 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Excel</span>
                </button>
                
                <button onClick={() => generateAdvancedPdf(records, churchName)} className="group flex flex-col sm:flex-row items-center justify-center gap-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 py-3.5 px-4 rounded-xl hover:border-rose-400 dark:hover:border-rose-500 transition-all shadow-sm hover:shadow-md">
                    <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-600 dark:text-rose-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">PDF</span>
                </button>
            </div>

            {/* Search & Filter Toggle */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                 <div className="relative w-full group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar miembro por nombre..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
                        autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && searchTerm && (
                        <ul className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 animate-in fade-in zoom-in-95 duration-100">
                            {suggestions.map(suggestion => (
                                <li key={suggestion.id} className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex items-center gap-2" onMouseDown={() => handleSuggestionClick(suggestion.nombre_completo)}>
                                    <span className="p-1 bg-indigo-50 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                    </span>
                                    {suggestion.nombre_completo}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button onClick={() => setAreFiltersVisible(!areFiltersVisible)} className={`flex items-center justify-center space-x-2 px-6 py-3.5 w-full md:w-auto border rounded-xl transition-all font-semibold ${areFiltersVisible ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    <span>Filtros</span>
                </button>
            </div>

             {/* Filters Area */}
             <div className={`transition-all duration-300 ease-in-out overflow-hidden ${areFiltersVisible ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Estado</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)} className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none text-sm shadow-sm">
                                <option value="all">Todos</option>
                                <option value="general">Activos y RT</option>
                                <option value="archivado">Archivados</option>
                                <option value="trasladado">Trasladados</option>
                            </select>
                            <div className="absolute right-3 bottom-3 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Grupo</label>
                            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none text-sm shadow-sm">
                                <option value="All">Todos</option>
                                {Object.entries(GROUP_DEFINITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <div className="absolute right-3 bottom-3 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Género</label>
                            <select value={filterGender} onChange={(e) => setFilterGender(e.target.value as GenderFilter)} className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none text-sm shadow-sm">
                                <option value="All">Todos</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                            </select>
                            <div className="absolute right-3 bottom-3 pointer-events-none text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                        </div>
                    </div>
                </div>
              </div>
        </div>

        {/* Records List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="hidden md:flex px-6 py-4 bg-slate-50/80 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider backdrop-blur-sm sticky top-0">
                <div className="flex-1 pl-2">Nombre Completo</div>
                <div className="w-24 text-center">Edad</div>
                <div className="w-24 text-center">Cédula</div>
                <div className="w-32 text-center">Grupo</div>
                <div className="w-40 text-center">Estado</div>
                <div className="w-32 text-right pr-2">Acciones</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredRecords.map(record => (
                    <div key={record.id} className="group flex flex-col md:flex-row items-start md:items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors duration-200">
                        
                        {/* Name (Main) */}
                        <div className="flex-1 mb-3 md:mb-0 min-w-0 pl-2">
                            <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{record.nombre_completo}</p>
                            {/* Mobile Only Info */}
                            <div className="md:hidden flex flex-wrap gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {calculateAge(record.fecha_nacimiento)} años
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {calculateDisplayGroup(record)}
                                </span>
                                {record.numero_cedula && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        Cédula OK
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Desktop Columns */}
                        <div className="hidden md:block w-24 text-center text-sm text-slate-600 dark:text-slate-300 font-medium">{calculateAge(record.fecha_nacimiento)}</div>
                        <div className="hidden md:flex w-24 justify-center">
                            {record.numero_cedula ? 
                                <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-1 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></span> : 
                                <span className="text-slate-300 dark:text-slate-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></span>
                            }
                        </div>
                        <div className="hidden md:block w-32 text-center">
                           <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                             {calculateDisplayGroup(record)}
                           </span>
                        </div>
                        <div className="w-full md:w-40 flex md:justify-center mt-3 md:mt-0 pl-2 md:pl-0">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusClass(record.estado)}`}>
                                {record.estado}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="w-full md:w-32 flex items-center justify-end gap-2 mt-4 md:mt-0 border-t md:border-0 border-slate-100 dark:border-slate-700 pt-3 md:pt-0">
                            <button onClick={() => handleOpenMemberSummary(record)} className="flex items-center justify-center w-8 h-8 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors" title="Resumen IA">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </button>
                            <button onClick={() => { setEditingRecord(record); setIsFormOpen(true); }} className="flex items-center justify-center w-8 h-8 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Editar">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
                
                {filteredRecords.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full mb-4 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin resultados</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">No encontramos coincidencias para tu búsqueda actual.</p>
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
      <MappingModal isOpen={isMappingModalOpen} onClose={() => setIsMappingModalOpen(false)} headers={excelHeaders} onConfirm={handleConfirmImport} />
      <CensusSummaryModal isOpen={isCensusModalOpen} onClose={() => setIsCensusModalOpen(false)} censusData={censusData} churchName={churchName} />

       {selectedRecordForSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setSelectedRecordForSummary(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-2xl flex flex-col border border-slate-100 dark:border-slate-700 max-h-[90vh] transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-8 border-b border-slate-100 dark:border-slate-700 pb-6">
                 <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Perfil del Miembro</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Detalles completos del registro</p>
                 </div>
                 <button onClick={() => setSelectedRecordForSummary(null)} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
            </div>
            
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Primary Info Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-5">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</span>
                            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{selectedRecordForSummary.nombre_completo}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Género</span>
                                <p className="text-base font-medium text-slate-700 dark:text-slate-300 mt-1">{selectedRecordForSummary.genero || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edad</span>
                                <p className="text-base font-medium text-slate-700 dark:text-slate-300 mt-1">{calculateAge(selectedRecordForSummary.fecha_nacimiento)} años</p>
                            </div>
                        </div>
                        <div>
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cédula</span>
                             <div className="mt-1 flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .883-.393 1.627-1 2.18"></path></svg>
                                <p className="text-base font-mono text-slate-700 dark:text-slate-300">{selectedRecordForSummary.numero_cedula || 'Sin registrar'}</p>
                             </div>
                        </div>
                    </div>

                    {/* Status & Group Info */}
                    <div className="space-y-6 py-2">
                         <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo Asignado</span>
                            <div className="mt-2 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {selectedRecordForSummary.grupo?.substring(0,2) || 'NA'}
                                </div>
                                <div>
                                    <p className="text-base font-bold text-slate-800 dark:text-slate-200">{GROUP_DEFINITIONS[selectedRecordForSummary.grupo as keyof typeof GROUP_DEFINITIONS] || selectedRecordForSummary.grupo}</p>
                                    <p className="text-xs text-slate-500">Clasificación oficial</p>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Estado de Membresía</span>
                             <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold border ${getStatusClass(selectedRecordForSummary.estado)}`}>
                                <span className="w-2 h-2 rounded-full bg-current mr-2 opacity-50"></span>
                                {selectedRecordForSummary.estado}
                            </span>
                        </div>

                         <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Nacimiento</span>
                            <p className="text-base font-medium text-slate-700 dark:text-slate-300 mt-1">{selectedRecordForSummary.fecha_nacimiento ? new Date(selectedRecordForSummary.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificada'}</p>
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        <span className="font-bold">Nota del sistema:</span> La edad y el grupo se calculan automáticamente en función de la fecha de nacimiento.
                    </p>
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button onClick={() => setSelectedRecordForSummary(null)} className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-indigo-600 rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-slate-200 dark:shadow-indigo-900/20">
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;