import React from 'react';

export interface CensusData {
  groups: {
    [key: string]: { H: number; M: number };
  };
  adultSubtotal: { H: number; M: number };
  children: { H: number; M: number };
  total: { H: number; M: number };
}

interface CensusSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  censusData: CensusData;
  churchName: string;
}

const GROUP_ORDER = ['CG', 'CM', 'CC', 'S', 'J'];

const CensusSummaryModal: React.FC<CensusSummaryModalProps> = ({ isOpen, onClose, censusData, churchName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
        
        <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center">
            <div>
                <h3 className="text-xl font-bold text-white">Resumen Estadístico</h3>
                <p className="text-indigo-100 text-sm mt-0.5">{churchName}</p>
            </div>
            <button onClick={onClose} className="text-indigo-100 hover:text-white bg-indigo-500/30 p-2 rounded-full transition-colors hover:bg-indigo-500/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700">Grupo</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-center border-b border-slate-100 dark:border-slate-700">Hombres</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-center border-b border-slate-100 dark:border-slate-700">Mujeres</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {GROUP_ORDER.map(groupKey => (
                    <tr key={groupKey} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{groupKey}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 text-center font-mono text-base">{censusData.groups[groupKey]?.H || 0}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 text-center font-mono text-base">{censusData.groups[groupKey]?.M || 0}</td>
                    </tr>
                ))}
                <tr className="bg-slate-50/80 dark:bg-slate-700/30 font-semibold">
                    <td className="p-4 text-slate-800 dark:text-slate-200 uppercase text-xs tracking-wide">Subtotal Adultos</td>
                    <td className="p-4 text-slate-800 dark:text-slate-200 text-center font-bold">{censusData.adultSubtotal.H}</td>
                    <td className="p-4 text-slate-800 dark:text-slate-200 text-center font-bold">{censusData.adultSubtotal.M}</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">Niños (N)</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 text-center font-mono text-base">{censusData.children.H}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 text-center font-mono text-base">{censusData.children.M}</td>
                </tr>
                <tr className="bg-slate-100 dark:bg-slate-900 font-bold text-lg border-t-2 border-slate-200 dark:border-slate-600">
                    <td className="p-5 text-slate-900 dark:text-white">TOTAL</td>
                    <td className="p-5 text-indigo-600 dark:text-indigo-400 text-center">{censusData.total.H}</td>
                    <td className="p-5 text-indigo-600 dark:text-indigo-400 text-center">{censusData.total.M}</td>
                </tr>
                </tbody>
            </table>
          </div>
        </div>
        
        <div className="p-6 pt-0 text-center">
          <button onClick={onClose} className="w-full py-3.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CensusSummaryModal;