import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Flight from '@/lib/models/Flight';
import { runLegalityAudit } from '@/lib/services/legalityService';
import { sendAuditEmail } from '@/lib/services/emailService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { flightId: string } }
) {
  try {
    await dbConnect();
    const { flightId } = params;

    // Run the legality audit (this updates the flight document)
    const result = await runLegalityAudit(flightId);

    // If no-go, send email alert
    if (result.overallStatus === 'no-go') {
      const flight = await Flight.findById(flightId)
        .populate('pilot')
        .populate('aircraft')
        .exec();
      if (flight && !flight.emailSent) {
        try {
          await sendAuditEmail(flight);
          flight.emailSent = true;
          await flight.save();
        } catch (emailErr) {
          console.warn('Email send failed:', emailErr);
        }
      }
    }

    // Return populated flight
    const populatedFlight = await Flight.findById(flightId)
      .populate('pilot')
      .populate('aircraft');

    return NextResponse.json({
      success: true,
      data: populatedFlight,
      audit: result,
    });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
