
import { NextRequest, NextResponse } from 'next/server';
import { fetchAircraftDetails } from '@/lib/services/firecrawlService';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tailNumber = searchParams.get('tailNumber');

  if (!tailNumber) {
    return NextResponse.json(
      { success: false, error: 'Tail number is required' },
      { status: 400 }
    );
  }

  try {
    const result = await fetchAircraftDetails(tailNumber);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
