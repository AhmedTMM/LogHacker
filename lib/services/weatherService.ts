import { IWeatherData } from '../models/Flight';

// Weather service using aviationweather.gov (ADDS) API
// This is a simplified implementation - production would use Firecrawl for more sophisticated scraping

export async function fetchWeatherData(airportCode: string): Promise<IWeatherData | null> {
  try {
    // ADDS Text Data Server URL for METAR data
    const station = airportCode.toUpperCase().replace(/^K/, '');
    const stationCode = airportCode.length === 3 ? `K${station}` : station;

    // In production, this would use Firecrawl to scrape aviation weather
    // For now, we'll use the ADDS API directly
    const url = `https://aviationweather.gov/api/data/metar?ids=${stationCode}&format=json&hours=1`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Weather API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const metar = data[0];

    // Parse flight category
    const flightCategory = determineFlightCategory(metar.visib, metar.clouds);

    // Parse wind data
    const wind = {
      direction: metar.wdir || 0,
      speed: metar.wspd || 0,
      gust: metar.wgst || undefined,
    };

    // Find ceiling
    const ceiling = findCeiling(metar.clouds);

    return {
      station: stationCode,
      metar: metar.rawOb || '',
      flightCategory,
      visibility: metar.visib || 10,
      ceiling,
      wind,
      fetchedAt: new Date(),
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

function determineFlightCategory(
  visibility: number | undefined,
  clouds: Array<{ cover: string; base: number }> | undefined
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  const vis = visibility ?? 10;
  const ceiling = findCeiling(clouds);

  // LIFR: Ceiling < 500 feet and/or visibility < 1 mile
  if (ceiling !== undefined && ceiling < 500) return 'LIFR';
  if (vis < 1) return 'LIFR';

  // IFR: Ceiling 500-1000 feet and/or visibility 1-3 miles
  if (ceiling !== undefined && ceiling < 1000) return 'IFR';
  if (vis < 3) return 'IFR';

  // MVFR: Ceiling 1000-3000 feet and/or visibility 3-5 miles
  if (ceiling !== undefined && ceiling < 3000) return 'MVFR';
  if (vis < 5) return 'MVFR';

  // VFR: Ceiling > 3000 feet and visibility > 5 miles
  return 'VFR';
}

function findCeiling(
  clouds: Array<{ cover: string; base: number }> | undefined
): number | undefined {
  if (!clouds || clouds.length === 0) return undefined;

  // Ceiling is the lowest BKN (broken) or OVC (overcast) layer
  for (const layer of clouds) {
    if (layer.cover === 'BKN' || layer.cover === 'OVC') {
      return layer.base;
    }
  }

  return undefined;
}

// Function to fetch TAF (Terminal Aerodrome Forecast)
export async function fetchTAFData(airportCode: string): Promise<string | null> {
  try {
    const station = airportCode.toUpperCase().replace(/^K/, '');
    const stationCode = airportCode.length === 3 ? `K${station}` : station;

    const url = `https://aviationweather.gov/api/data/taf?ids=${stationCode}&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    return data[0].rawTAF || null;
  } catch (error) {
    console.error('Error fetching TAF:', error);
    return null;
  }
}
