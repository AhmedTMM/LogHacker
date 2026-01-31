import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Flight from '@/lib/models/Flight';
import { sendAuditEmail } from '@/lib/services/emailService';

export async function POST(
  request: NextRequest,
  { params }: { params: { flightId: string } }
) {
  try {
    await dbConnect();

    const flight = await Flight.findById(params.flightId)
      .populate('pilot')
      .populate('aircraft');

    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Flight not found' },
        { status: 404 }
      );
    }

    const result = await sendAuditEmail(flight);

    if (result.success) {
      flight.emailSent = true;
      await flight.save();
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
