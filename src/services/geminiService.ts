import { GoogleGenAI } from "@google/genai";
import type { CensusRecord } from '../types';
import { calculateAge, GROUP_DEFINITIONS } from '../utils/helpers';

// Use Vite's environment variables for the API key
const GEMINI_API_KEY = import.meta.env.VITE_API_KEY;

if (!GEMINI_API_KEY) {
  // This will throw an error during the build process if the key is not set
  throw new Error("VITE_API_KEY is not defined in the environment variables.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
