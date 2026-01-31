import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Aircraft from '@/lib/models/Aircraft';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const aircraft = await Aircraft.findById(params.id);
    if (!aircraft) {
      return NextResponse.json(
        { success: false, error: 'Aircraft not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: aircraft });
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
    const aircraft = await Aircraft.findByIdAndUpdate(params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!aircraft) {
      return NextResponse.json(
        { success: false, error: 'Aircraft not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: aircraft });
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
    const aircraft = await Aircraft.findByIdAndDelete(params.id);
    if (!aircraft) {
      return NextResponse.json(
        { success: false, error: 'Aircraft not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'Aircraft deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
