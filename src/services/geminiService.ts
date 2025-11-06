import { GoogleGenAI } from "@google/genai";
import type { CensusRecord } from '../types';
import { calculateAge, GROUP_DEFINITIONS } from '../utils/helpers';

// Fix: Per @google/genai guidelines, the API key must be obtained exclusively from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMemberSummary = async (record: CensusRecord): Promise<string> => {
  const age = calculateAge(record.fecha_nacimiento);
  const groupName = record.grupo ? GROUP_DEFINITIONS[record.grupo] : 'No especificado';
  
  const prompt = `
    Eres un asistente administrativo para una iglesia. Tu tarea es generar un resumen profesional y bien estructurado sobre un miembro de la congregación, basado en los datos proporcionados. El tono debe ser formal pero cordial.

    **Instrucciones:**
    1.  Presenta la información de forma clara y organizada en un párrafo.
    2.  Comienza siempre con el nombre completo del miembro.
    3.  Menciona su estado actual en la congregación (Activo o Retirado Temporal).
    4.  Menciona el grupo al que pertenece.
    5.  **IMPORTANTE:** No incluyas el número de cédula en tu resumen. Es información sensible.

    **Datos del Miembro:**
    - Nombre: ${record.nombre_completo}
    - Fecha de Nacimiento: ${record.fecha_nacimiento || 'No especificada'}
    - Edad: ${age} años
    - Género: ${record.genero || 'No especificado'}
    - Grupo: ${groupName}
    - Estado: ${record.estado}
    - Cédula: ${record.numero_cedula || 'No registrada'}

    Genera el resumen profesional para el miembro.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "No se pudo generar el resumen. Por favor, inténtelo de nuevo.";
  }
};
