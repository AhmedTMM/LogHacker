import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Flight from '@/lib/models/Flight';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const flight = await Flight.findById(params.id)
      .populate('pilot')
      .populate('aircraft');

    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Flight not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: flight });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const body = await request.json();
    const flight = await Flight.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    })
      .populate('pilot')
      .populate('aircraft');

    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Flight not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: flight });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const flight = await Flight.findByIdAndDelete(params.id);
    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Flight not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'Flight deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
