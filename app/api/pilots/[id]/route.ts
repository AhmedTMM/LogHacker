import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Pilot from '@/lib/models/Pilot';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const pilot = await Pilot.findById(params.id);
    if (!pilot) {
      return NextResponse.json(
        { success: false, error: 'Pilot not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: pilot });
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
    const pilot = await Pilot.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!pilot) {
      return NextResponse.json(
        { success: false, error: 'Pilot not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: pilot });
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
    const pilot = await Pilot.findByIdAndDelete(params.id);
    if (!pilot) {
      return NextResponse.json(
        { success: false, error: 'Pilot not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'Pilot deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
