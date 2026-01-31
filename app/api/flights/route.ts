import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Flight from '@/lib/models/Flight';
import { runLegalityAudit } from '@/lib/services/legalityService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming');

    let query: Record<string, unknown> = {};

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.scheduledDate = { $gte: new Date() };
    }

    const flights = await Flight.find(query)
      .populate('pilot', 'name email certificates experience')
      .populate('aircraft', 'tailNumber model maintenanceDates currentHours')
      .sort({ scheduledDate: 1 });

    return NextResponse.json({ success: true, data: flights });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const flight = new Flight({
      ...body,
      status: 'planned',
      overallStatus: 'no-go',
    });
    await flight.save();

    // Run initial safety/legality audit (creates snapshot)
    await runLegalityAudit(flight._id.toString());

    const populatedFlight = await Flight.findById(flight._id)
      .populate('pilot')
      .populate('aircraft');

    return NextResponse.json({ success: true, data: populatedFlight }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
