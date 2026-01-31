import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherData, fetchTAFData } from '@/lib/services/weatherService';

export async function GET(
  request: NextRequest,
  { params }: { params: { airport: string } }
) {
  try {
    const airport = params.airport.toUpperCase();

    // Fetch METAR and TAF in parallel
    const [metar, taf] = await Promise.all([
      fetchWeatherData(airport),
      fetchTAFData(airport),
    ]);

    if (!metar) {
      return NextResponse.json(
        { success: false, error: `No weather data found for ${airport}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...metar,
        taf: taf || undefined,
      },
    });
  } catch (error) {
    console.error('Weather fetch error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
