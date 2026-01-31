// Reducto Document Intelligence Service
// For parsing handwritten pilot logbooks and maintenance PDFs

interface ReductoResponse {
  success: boolean;
  data?: ParsedDocument;
  error?: string;
}

interface ParsedDocument {
  documentType: 'logbook' | 'maintenance' | 'unknown';
  extractedData: Record<string, any>;
  confidence: number;
  rawText: string;
}

interface LogbookEntry {
  date: string;
  aircraft: string;
  route: string;
  duration: number;
  remarks?: string;
}

interface MaintenanceEntry {
  date: string;
  description: string;
  hobbsTime?: number;
  tachTime?: number;
  mechanic?: string;
  signOff?: boolean;
}

import { Reducto, toFile } from 'reductoai';
import { ExtractRunResponse } from 'reductoai/resources/extract';


export async function parseDocument(
  fileBase64: string,
  fileType: 'pdf' | 'image',
  documentType: 'logbook' | 'maintenance'
): Promise<ReductoResponse> {
  const apiKey = process.env.REDUCTO_API_KEY;

  if (!apiKey) {
    console.warn('Reducto API key not configured');
    return {
      success: false,
      error: 'Reducto API key not configured',
    };
  }

  try {
    const client = new Reducto({ apiKey });

    // 1. Upload File using helper
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const upload = await client.upload({
      file: await toFile(fileBuffer, fileType === 'image' ? 'document.png' : 'document.pdf'),
      extension: fileType === 'image' ? 'png' : 'pdf',
    });

    // 2. Prepare Prompt
    const prompt = documentType === 'logbook'
      ? LOGBOOK_EXTRACTION_PROMPT
      : MAINTENANCE_EXTRACTION_PROMPT;

    // 3. Extract Structured Data
    const extraction = await client.extract.run({
      input: upload,
      instructions: {
        system_prompt: prompt,
      },
      settings: {
        optimize_for_latency: true
      }
    });

    // 4. Adapt to internal format
    if ('job_id' in extraction && !('result' in extraction)) {
      // Handle async response if it happens (though we didn't request async)
      return { success: false, error: 'Received async job id but expected sync result' };
    }

    const items = (extraction as any).result || [];
    let extractedData: Record<string, any> = {};

    if (documentType === 'logbook') {
      extractedData = { entries: items };
    } else {
      extractedData = { entries: items };
    }

    return {
      success: true,
      data: {
        documentType: documentType,
        extractedData,
        confidence: 1.0,
        rawText: '',
      },
    };
  } catch (error) {
    console.error('Reducto service error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Process raw Reducto output into structured data
function processExtractedData(rawResult: any, documentType: string): ParsedDocument {
  const extractedText = rawResult.text || rawResult.extracted_text || '';
  const tables = rawResult.tables || [];
  const structuredData = rawResult.structured_data || {};

  let extractedData: Record<string, any> = {};

  if (documentType === 'logbook') {
    extractedData = parseLogbookData(structuredData, tables, extractedText);
  } else if (documentType === 'maintenance') {
    extractedData = parseMaintenanceData(structuredData, tables, extractedText);
  }

  return {
    documentType: documentType as 'logbook' | 'maintenance',
    extractedData,
    confidence: rawResult.confidence || 0.8,
    rawText: extractedText,
  };
}

// Parse pilot logbook entries
function parseLogbookData(
  structured: any,
  tables: any[],
  rawText: string
): { entries: LogbookEntry[] } {
  const entries: LogbookEntry[] = [];

  // If structured data contains entries
  if (structured.entries) {
    for (const entry of structured.entries) {
      entries.push({
        date: entry.date || '',
        aircraft: entry.aircraft || entry.tail_number || '',
        route: entry.route || entry.from_to || '',
        duration: parseFloat(entry.duration || entry.total_time || '0'),
        remarks: entry.remarks || entry.notes || '',
      });
    }
  }

  // Parse from tables if available
  if (tables.length > 0) {
    for (const table of tables) {
      const headers = table.headers || [];
      const rows = table.rows || [];

      for (const row of rows) {
        const entry: LogbookEntry = {
          date: '',
          aircraft: '',
          route: '',
          duration: 0,
        };

        headers.forEach((header: string, idx: number) => {
          const value = row[idx];
          const headerLower = header.toLowerCase();

          if (headerLower.includes('date')) entry.date = value;
          if (headerLower.includes('aircraft') || headerLower.includes('tail'))
            entry.aircraft = value;
          if (headerLower.includes('route') || headerLower.includes('from'))
            entry.route = value;
          if (headerLower.includes('time') || headerLower.includes('duration'))
            entry.duration = parseFloat(value) || 0;
          if (headerLower.includes('remark')) entry.remarks = value;
        });

        if (entry.date || entry.aircraft) {
          entries.push(entry);
        }
      }
    }
  }

  return { entries };
}

// Parse maintenance log entries
function parseMaintenanceData(
  structured: any,
  tables: any[],
  rawText: string
): { entries: MaintenanceEntry[] } {
  const entries: MaintenanceEntry[] = [];

  // If structured data contains entries
  if (structured.entries || structured.maintenance_items) {
    const items = structured.entries || structured.maintenance_items;
    for (const entry of items) {
      entries.push({
        date: entry.date || '',
        description: entry.description || entry.work_performed || '',
        hobbsTime: parseFloat(entry.hobbs || entry.hobbs_time || '0') || undefined,
        tachTime: parseFloat(entry.tach || entry.tach_time || '0') || undefined,
        mechanic: entry.mechanic || entry.technician || '',
        signOff: entry.sign_off || entry.signed || false,
      });
    }
  }

  // Parse annual/inspection data
  if (structured.annual_date || structured.last_annual) {
    entries.push({
      date: structured.annual_date || structured.last_annual,
      description: 'Annual Inspection',
      signOff: true,
    });
  }

  return { entries };
}

// Extraction prompts for different document types
const LOGBOOK_EXTRACTION_PROMPT = `
You are an expert at parsing pilot logbook pages. Extract EVERY flight entry from the table.

IMPORTANT: Logbooks have many columns for different hour types. Look for ALL of these:

REQUIRED FIELDS (extract if visible):
- date: Flight date (YYYY-MM-DD format)
- aircraftIdent: Tail number (e.g., N12345, N5392R)
- aircraftType: Make/model (e.g., C172, PA-28, SR22)
- from: Departure airport (4-letter ICAO preferred, e.g., KJFK)
- to: Destination airport
- route: Full route if multi-leg (e.g., "KJFK-KBOS-KJFK")

HOUR COLUMNS (extract ALL that are visible, use decimal hours like 1.5):
- totalTime: Total flight time (SEL, MEL, or total column)
- sel: Single Engine Land time
- mel: Multi Engine Land time
- pic: Pilot In Command time
- sic: Second In Command time
- solo: Solo flight time
- dualReceived: Instruction received time
- dualGiven: Instruction given (CFI) time
- crossCountry: Cross-country time (XC)
- night: Night flying time
- actualInstrument: Actual IMC time
- simulatedInstrument: Simulated/hood instrument time
- flightSim: Simulator/AATD/BATD time
- groundTrainer: Ground trainer time

LANDINGS (look for day/night columns):
- landingsDay: Number of day landings
- landingsNight: Number of night landings
- landingsFullStop: Full stop landings if separate

REMARKS (critical - capture everything):
- remarks: ALL text from remarks column including:
  - Instructor signatures/names
  - Endorsements given/received
  - Approach types (ILS, VOR, GPS, LOC)
  - Number of approaches
  - Holds
  - Night currency note
  - Checkride notes
  - Any other comments

OUTPUT FORMAT:
Return a JSON array where each flight is an object. Include ONLY fields that have values.
Parse EVERY row - do not skip any entries. If handwriting is unclear, make your best guess.

Example:
[
  {
    "date": "2024-01-15",
    "aircraftIdent": "N5392R",
    "aircraftType": "C172",
    "from": "KJFK",
    "to": "KBOS",
    "totalTime": 2.5,
    "sel": 2.5,
    "pic": 2.5,
    "crossCountry": 2.5,
    "landingsDay": 1,
    "remarks": "XC to Boston. 1 ILS approach RWY 4R. J. Smith - CFI"
  },
  {
    "date": "2024-01-16",
    "aircraftIdent": "N5392R",
    "aircraftType": "C172",
    "from": "KBOS",
    "to": "KJFK",
    "totalTime": 2.3,
    "sel": 2.3,
    "pic": 2.3,
    "night": 1.5,
    "actualInstrument": 0.5,
    "crossCountry": 2.3,
    "landingsNight": 1,
    "remarks": "Night XC return. 2 VOR approaches. IMC for 30 min"
  }
]
`;

const MAINTENANCE_EXTRACTION_PROMPT = `
Extract aircraft maintenance log entries from this document. For each maintenance entry, identify:
- Date of maintenance
- Description of work performed
- Hobbs time (if listed)
- Tach time (if listed)
- Mechanic name or signature
- Sign-off/approval status

Also extract any inspection dates such as:
- Annual inspection date
- 100-hour inspection date
- Transponder check date
- Static system check date

Return structured data with all entries and dates found.
`;

const POH_EXTRACTION_PROMPT = `
Extract operating limits and specifications from this Pilot Operating Handbook (POH).
Specifically extract:
1. V-Speeds (in Knots):
   - Vso (Stall speed in landing configuration)
   - Vs1 (Stall speed in clean configuration)
   - Vr (Rotation speed)
   - Vx (Best angle of climb)
   - Vy (Best rate of climb)
   - Vfe (Maximum flap extended speed)
   - Va (Maneuvering speed)
   - Vno (Max structural cruising speed)
   - Vne (Never exceed speed)

2. Weights (in lbs):
   - Max Gross Weight
   - Standard Empty Weight
   - Useful Load
   - Fuel Capacity (Total and Usable in gallons)

Return as a JSON object with keys: vSpeeds (object with keys above camelCase), weights (object with keys above camelCase).
`;

// Parse POH from URL
export async function parsePOHFromUrl(pohUrl: string): Promise<ReductoResponse> {
  try {
    const apiKey = process.env.REDUCTO_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Reducto API key not configured' };
    }

    // 1. Fetch PDF manually to avoid Reducto download issues
    const response = await fetch(pohUrl);
    if (!response.ok) throw new Error(`Failed to fetch POH PDF: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const client = new Reducto({ apiKey });

    // 2. Upload
    const upload = await client.upload({
      file: await toFile(buffer, 'poh.pdf'),
      extension: 'pdf'
    });

    // 3. Extract
    const extraction = await client.extract.run({
      input: upload,
      instructions: {
        system_prompt: POH_EXTRACTION_PROMPT
      }
    });

    if ('job_id' in extraction && !('result' in extraction)) {
      return { success: false, error: 'Async job ID returned' };
    }

    const res = (extraction as any).result;
    const data = res && res.length > 0 ? res[0] : {};

    return {
      success: true,
      data: {
        documentType: 'unknown',
        extractedData: data as Record<string, any>,
        confidence: 1.0,
        rawText: '',
      }
    };

  } catch (error) {
    console.error('POH parsing error:', error);
    return { success: false, error: (error as Error).message };
  }
}

export type { ReductoResponse, ParsedDocument };

export function aggregateLogbookHours(entries: LogbookEntry[]): {
  totalHours: number;
  picHours: number;
  nightHours: number;
  ifrHours: number;
  last90DaysHours: number;
  last30DaysHours: number;
} {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalHours = 0;
  let picHours = 0;
  let nightHours = 0;
  let ifrHours = 0;
  let last90DaysHours = 0;
  let last30DaysHours = 0;

  for (const entry of entries) {
    const duration = entry.duration || 0;
    totalHours += duration;

    // Simple heuristics since our basic prompt might not capture every column
    // Assume if it's in the logbook, it contributes to total.
    // We'll estimate PIC as 100% for now unless defined otherwise (often safe for private logbooks uploaded by owner)
    // Real parsing would look for specific columns.
    picHours += duration;

    // Check remarks for "Night" or "IFR" keywords if explicit columns missing
    const remarks = (entry.remarks || '').toLowerCase();

    if (remarks.includes('night')) {
      nightHours += duration;
    }

    if (remarks.includes('ifr') || remarks.includes('imc') || remarks.includes('approach')) {
      ifrHours += duration;
    }

    // Date based calc
    if (entry.date) {
      const entryDate = new Date(entry.date);
      if (!isNaN(entryDate.getTime())) {
        if (entryDate >= ninetyDaysAgo) last90DaysHours += duration;
        if (entryDate >= thirtyDaysAgo) last30DaysHours += duration;
      }
    }
  }

  return {
    totalHours,
    picHours,
    nightHours,
    ifrHours,
    last90DaysHours,
    last30DaysHours
  };
}
