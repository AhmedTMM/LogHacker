// Firecrawl Web Intelligence Service

interface FirecrawlResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface AirworthinessDirective {
  adNumber: string;
  title: string;
  effectiveDate: string;
  applicability: string;
  description: string;
  url: string;
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

const AD_EXTRACTION_PROMPT = `
Extract all Airworthiness Directives from this page. For each AD, extract:
- AD number
- Title or subject
- Effective date
- Applicability (which aircraft models/serials affected)
- Brief description of required action
- Link to full AD document if available

Return as a structured list of airworthiness_directives.
`;

const NTSB_EXTRACTION_PROMPT = `
Extract all NTSB accident/incident reports from this page. For each report, extract:
- Report ID (e.g., WPR21LA001)
- Event Date
- Location
- Aircraft (Make/Model)
- Severity (Fatal, Non-fatal, Incident)
- Investigation Status
- Brief Description

Return as a structured list of reports.
`;

const AIRCRAFT_IMAGE_EXTRACTION_PROMPT = `
Find the main aircraft photo on this page. Extract:
- The direct URL to the highest quality image of the aircraft
- Prefer photos that show the full aircraft from the side

Return as: { "image_url": "..." }
`;

const PILOT_ACCIDENT_EXTRACTION_PROMPT = `
Extract NTSB accident reports associated with this pilot name.
For each report, extract:
- Event Date
- Location
- Aircraft Make/Model
- Injury Severity
- Brief Description

Return as a list of reports.
`;

export async function scrapeUrl(url: string, extractionPrompt?: string): Promise<FirecrawlResponse> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'Firecrawl API key not configured' };
  }

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'extract'],
        extract: extractionPrompt ? { prompt: extractionPrompt } : undefined,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Firecrawl API error: ${response.status}` };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Search for Airworthiness Directives
export async function searchAirworthinessDirectives(
  manufacturer: string,
  model: string
): Promise<{ success: boolean; directives: AirworthinessDirective[]; error?: string }> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: true, directives: [] };
  }

  try {
    const adSearchUrl = `https://www.faa.gov/regulations_policies/airworthiness_directives/search?aircraft_model=${encodeURIComponent(model)}&manufacturer=${encodeURIComponent(manufacturer)}`;
    const result = await scrapeUrl(adSearchUrl, AD_EXTRACTION_PROMPT);

    if (!result.success) {
      return { success: false, directives: [], error: result.error };
    }

    const directives: AirworthinessDirective[] = [];
    if (result.data?.extract?.airworthiness_directives) {
      for (const ad of result.data.extract.airworthiness_directives) {
        directives.push({
          adNumber: ad.ad_number || ad.number || '',
          title: ad.title || ad.subject || '',
          effectiveDate: ad.effective_date || ad.date || '',
          applicability: ad.applicability || ad.applies_to || '',
          description: ad.description || ad.summary || '',
          url: ad.url || '',
        });
      }
    }

    return { success: true, directives };
  } catch (error) {
    return { success: false, directives: [], error: (error as Error).message };
  }
}

// Search for NTSB reports for a specific aircraft model
export async function searchNTSBReports(
  manufacturer: string,
  model: string
): Promise<{ success: boolean; reports: any[]; error?: string }> {
  try {
    const query = `site:ntsb.gov ${manufacturer} ${model} accident report`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const result = await scrapeUrl(searchUrl, NTSB_EXTRACTION_PROMPT);

    if (result.success && result.data?.extract?.reports) {
      return { success: true, reports: result.data.extract.reports };
    }

    return { success: true, reports: [] };
  } catch (error) {
    return { success: false, reports: [], error: (error as Error).message };
  }
}

// Search for aircraft image by tail number
export async function fetchAircraftImage(tailNumber: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, error: 'Firecrawl API key not configured' };
  }

  try {
    const cleanTail = tailNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const planespottersUrl = `https://www.planespotters.net/search?q=${cleanTail}`;

    const result = await scrapeUrl(planespottersUrl, AIRCRAFT_IMAGE_EXTRACTION_PROMPT);
    if (result.success && result.data?.extract?.image_url) {
      return { success: true, imageUrl: result.data.extract.image_url };
    }

    // Fallback: try JetPhotos
    const jetphotosUrl = `https://www.jetphotos.com/registration/${cleanTail}`;
    const jetResult = await scrapeUrl(jetphotosUrl, AIRCRAFT_IMAGE_EXTRACTION_PROMPT);
    if (jetResult.success && jetResult.data?.extract?.image_url) {
      return { success: true, imageUrl: jetResult.data.extract.image_url };
    }

    return { success: true, imageUrl: undefined };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Fetch aircraft details from FAA Registry
export async function fetchAircraftDetails(tailNumber: string): Promise<{
  success: boolean;
  data?: {
    manufacturer: string;
    model: string;
    serial: string;
    year: number;
    imageUrl?: string;
    pohUrl?: string;
    operatingLimits?: { vSpeeds: any; weights: any };
  };
  error?: string;
}> {
  if (!process.env.FIRECRAWL_API_KEY) {
    return { success: false, error: 'Firecrawl API key not configured' };
  }

  try {
    const cleanTail = tailNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanTail.startsWith('N')) {
      const url = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${cleanTail}`;
      const prompt = `Extract: Manufacturer Name, Model Name, Serial Number, Mfr Year. Return as JSON: { manufacturer, model, serial, year }`;

      const result = await scrapeUrl(url, prompt);
      if (result.success && result.data?.extract) {
        const data = result.data.extract;
        const pohAndLimits = getPOHAndLimits(data.model || '');
        const imageResult = await fetchAircraftImage(tailNumber);

        return {
          success: true,
          data: {
            manufacturer: data.manufacturer || '',
            model: data.model || '',
            serial: data.serial || '',
            year: parseInt(data.year) || new Date().getFullYear(),
            imageUrl: imageResult.imageUrl,
            ...pohAndLimits,
          }
        };
      }
    }

    return { success: false, error: 'Could not fetch aircraft details' };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Get POH and Operating Limits for common aircraft
function getPOHAndLimits(model: string): { pohUrl?: string; operatingLimits?: { vSpeeds: any; weights: any } } {
  // Parsing logic for specific models could go here, but avoiding "filler" data
  // Only return if we have a verified source (future implementation)
  return {};
}

// Search for accidents associated with a pilot name
export async function searchPilotAccidents(name: string): Promise<{
  success: boolean;
  reports: any[];
  error?: string;
}> {
  try {
    const query = `site:ntsb.gov accident report pilot "${name}"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const result = await scrapeUrl(searchUrl, PILOT_ACCIDENT_EXTRACTION_PROMPT);

    if (result.success && result.data?.extract?.reports) {
      return { success: true, reports: result.data.extract.reports };
    }

    return { success: true, reports: [] };
  } catch (error) {
    return { success: false, reports: [], error: (error as Error).message };
  }
}

export type { FirecrawlResponse, AirworthinessDirective };
