import { NextRequest, NextResponse } from 'next/server';
import { searchAirworthinessDirectives, searchNTSBReports } from '@/lib/services/firecrawlService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const manufacturer = searchParams.get('manufacturer');
        const model = searchParams.get('model');
        if (!manufacturer || !model) {
            return NextResponse.json(
                { success: false, error: 'Manufacturer and Model are required' },
                { status: 400 }
            );
        }

        const [adsResult, ntsbResult] = await Promise.all([
            searchAirworthinessDirectives(manufacturer, model),
            searchNTSBReports(manufacturer, model)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                ads: adsResult.directives || [],
                ntsb: ntsbResult.reports || [],
                errors: {
                    ads: adsResult.error,
                    ntsb: ntsbResult.error
                }
            }
        });

    } catch (error) {
        console.error('Safety data fetch error:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
