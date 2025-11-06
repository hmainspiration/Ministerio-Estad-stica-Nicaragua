import React from 'react';

// Define the structure for the census data
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 m-4 max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Censo General - {churchName}</h3>
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="p-3 font-bold uppercase text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Grupo</th>
                <th className="p-3 font-bold uppercase text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-center">H</th>
                <th className="p-3 font-bold uppercase text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 text-center">M</th>
              </tr>
            </thead>
            <tbody>
              {GROUP_ORDER.map(groupKey => (
                <tr key={groupKey} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-3 font-semibold text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">{groupKey}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-center">{censusData.groups[groupKey]?.H || 0}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-center">{censusData.groups[groupKey]?.M || 0}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                <td className="p-3 uppercase text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600">Subtotal</td>
                <td className="p-3 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-center">{censusData.adultSubtotal.H}</td>
                <td className="p-3 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-center">{censusData.adultSubtotal.M}</td>
              </tr>
               <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-3 font-semibold text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">N</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-center">{censusData.children.H}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-center">{censusData.children.M}</td>
                </tr>
              <tr className="bg-gray-200 dark:bg-gray-900 font-extrabold text-lg">
                <td className="p-3 uppercase text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">Total</td>
                <td className="p-3 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 text-center">{censusData.total.H}</td>
                <td className="p-3 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 text-center">{censusData.total.M}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default CensusSummaryModal;