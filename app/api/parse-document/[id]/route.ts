import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ParsedDocument from '@/lib/models/ParsedDocument';

// GET: Get a single parsed document with full data
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const doc = await ParsedDocument.findById(params.id)
            .populate('aircraft', 'tailNumber model')
            .lean();

        if (!doc) {
            return NextResponse.json(
                { success: false, error: 'Document not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: doc });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

// PATCH: Update document (link to aircraft, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const body = await request.json();
        const { aircraftId, pilotId } = body;

        const update: Record<string, any> = {};
        if (aircraftId !== undefined) update.aircraft = aircraftId || null;
        if (pilotId !== undefined) update.pilot = pilotId || null;

        const doc = await ParsedDocument.findByIdAndUpdate(
            params.id,
            { $set: update },
            { new: true }
        ).lean();

        if (!doc) {
            return NextResponse.json(
                { success: false, error: 'Document not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: doc });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}

// DELETE: Remove a parsed document
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        await ParsedDocument.findByIdAndDelete(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
