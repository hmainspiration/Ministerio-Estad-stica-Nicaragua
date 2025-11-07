import type { CensusRecord } from '../types';
import { calculateAge, calculateDisplayGroup, calculateTotals } from './helpers';

declare const XLSX: any;
declare global {
  interface Window {
    jspdf: any;
  }
}

// NEW ADVANCED PDF GENERATOR
export const generateAdvancedPdf = (records: CensusRecord[], churchName: string) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const totals = calculateTotals(records);

    // --- PDF HEADER ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Ministerio de Coordinación de Estadística Internacional', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(18);
    doc.text('LISTA DE MIEMBRESIA', doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${churchName.toUpperCase()}, GR.`, doc.internal.pageSize.getWidth() / 2, 32, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('CODIGO: NIGR06', 14, 45);

    // M.A: Archivados, M.E: Cantidad de Niños
    const ninosCount = records.filter(r => r.grupo === 'N' && (r.estado === 'Activo' || r.estado === 'Retirado Temporal')).length;
    const totalsText = `ACT: ${totals.act} RT: ${totals.rt} M.A: ${totals.ma} M.E: ${ninosCount}`;
    doc.text(totalsText, doc.internal.pageSize.getWidth() - 14, 45, { align: 'right' });

    let yPosition = 55;

    // --- DATA & TABLES ---
    const addSection = (title: string, data: CensusRecord[], isFirstSection: boolean = false) => {
        if (data.length === 0) return;

        if (!isFirstSection) {
             yPosition = (doc as any).lastAutoTable.finalY;
             // Add a new page if there's not enough space for the title and a few rows
             if (yPosition > doc.internal.pageSize.getHeight() - 50) {
                doc.addPage();
                yPosition = 20;
             } else {
                yPosition += 15;
             }
        }
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
        yPosition += 10;

        const tableColumn = ["N", "NOMBRE COMPLETO", "FECHA DE NAC.", "EDAD", "N° CEDULA", "ACT", "RT", "GRUPO"];
        const tableRows: any[][] = [];

        data.forEach((record, index) => {
            const birthDate = record.fecha_nacimiento ? new Date(record.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            const recordData = [
                index + 1,
                record.nombre_completo,
                birthDate,
                calculateAge(record.fecha_nacimiento),
                record.numero_cedula || '',
                record.estado === 'Activo' ? 'X' : '',
                record.estado === 'Retirado Temporal' ? 'X' : '',
                calculateDisplayGroup(record),
            ];
            tableRows.push(recordData);
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [191, 219, 254], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 8 },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 'auto' } }
        });
    };
    
    const activeAndRT = records.filter(r => r.estado === 'Activo' || r.estado === 'Retirado Temporal');
    const hombres = activeAndRT.filter(r => r.genero === 'Masculino' && r.grupo !== 'N').sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const mujeres = activeAndRT.filter(r => r.genero === 'Femenino' && r.grupo !== 'N').sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const ninos = activeAndRT.filter(r => r.grupo === 'N').sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const archivados = records.filter(r => r.estado === 'Archivado').sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));
    const trasladados = records.filter(r => r.estado === 'Trasladado').sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo));

    addSection('HOMBRES', hombres, true);
    addSection('MUJERES', mujeres);
    addSection('NIÑOS', ninos);
    addSection('ARCHIVOS', archivados);
    addSection('TRASLADOS', trasladados);

    doc.save(`Lista_Membresia_${churchName.replace(/\s/g, '_')}.pdf`);
};


// NEW MULTI-SHEET EXCEL EXPORTER
export const exportToMultiSheetExcel = (records: CensusRecord[], churchName: string) => {
    const workbook = XLSX.utils.book_new();

    const createSheetData = (data: CensusRecord[]) => {
      return data.sort((a,b) => a.nombre_completo.localeCompare(b.nombre_completo)).map((record, index) => ({
        'N': index + 1,
        'NOMBRE COMPLETO': record.nombre_completo,
        'FECHA DE NAC.': record.fecha_nacimiento,
        'EDAD': calculateAge(record.fecha_nacimiento),
        'N° CEDULA': record.numero_cedula,
        'GENERO': record.genero,
        'GRUPO': calculateDisplayGroup(record),
        'ESTADO': record.estado,
      }));
    };

    const hombres = records.filter(r => r.genero === 'Masculino' && r.grupo !== 'N');
    const mujeres = records.filter(r => r.genero === 'Femenino' && r.grupo !== 'N');
    const ninos = records.filter(r => r.grupo === 'N');
    const archivados = records.filter(r => r.estado === 'Archivado');
    const trasladados = records.filter(r => r.estado === 'Trasladado');

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(createSheetData(hombres)), 'Hombres');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(createSheetData(mujeres)), 'Mujeres');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(createSheetData(ninos)), 'Niños');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(createSheetData(archivados)), 'Archivados');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(createSheetData(trasladados)), 'Trasladados');

    XLSX.writeFile(workbook, `Censo_Completo_${churchName.replace(/\s/g, '_')}.xlsx`);
};

// UPDATED MULTI-SHEET EXCEL READER
export const readExcelFile = (file: File): Promise<{ headers: string[], data: any[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        let allData: any[] = [];
        let headers: string[] = [];

        if (workbook.SheetNames.length > 0) {
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            headers = (XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] as string[] || []).filter(h => h);
        }

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
            allData = allData.concat(jsonData);
        });
        
        if (headers.length === 0) {
            throw new Error("No se pudieron leer las cabeceras de la primera hoja del archivo Excel.");
        }

        resolve({ headers, data: allData });
      } catch (error) {
        console.error("Error reading Excel file:", error);
        reject(new Error("No se pudo leer el archivo Excel. Asegúrese de que sea un archivo válido y con cabeceras en la primera hoja."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};