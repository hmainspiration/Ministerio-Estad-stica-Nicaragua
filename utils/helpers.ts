import type { CensusRecord } from '../types';

export const calculateTotals = (records: CensusRecord[]): { act: number; rt: number; ma: number; me: number } => {
  let act = 0;
  let rt = 0;
  let ma = 0;
  let me = 0;

  records.forEach(record => {
    switch (record.estado) {
      case 'Activo':
        if (record.grupo !== 'N') {
          act++;
        }
        break;
      case 'Retirado Temporal':
        if (record.grupo !== 'N') {
          rt++;
        }
        break;
      case 'Archivado':
        ma++;
        break;
      case 'Trasladado':
        me++;
        break;
    }
  });

  return { act, rt, ma, me };
};

export const GROUP_DEFINITIONS: Record<NonNullable<CensusRecord['grupo']>, string> = {
  'C': 'C (Casado)',
  'CC': 'CC (Casado Chico)',
  'CM': 'CM (Casado Mediano)',
  'CG': 'CG (Casado Grande)',
  'J': 'J (Joven)',
  'S': 'S (Sol@)',
  'N': 'N (Niñ@s)'
};

export const calculateAge = (birthDate?: string): number | string => {
  if (!birthDate) return 'N/A';
  try {
    // Ensure the date is parsed as UTC to avoid timezone issues
    const birth = new Date(birthDate + 'T00:00:00');
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch (error) {
    return 'N/A';
  }
};

export const calculateDisplayGroup = (record: CensusRecord): string => {
    const age = calculateAge(record.fecha_nacimiento);
    const baseGroup = record.grupo || '';
    
    const groupToEvaluate = baseGroup.toUpperCase();
    // Only calculate subgroup if the base group is 'C'.
    // If 'CC', 'CM', or 'CG' is explicitly set, respect it.
    if (groupToEvaluate === 'C') {
        if (typeof age === 'number') {
            if (age <= 30) return 'CC';
            if (age <= 45) return 'CM';
            return 'CG';
        }
        // If age is not available but group is C, return 'C'
        return baseGroup; 
    }
    
    // For other groups like CC, CM, CG, J, S, N, return them as is.
    return baseGroup;
};