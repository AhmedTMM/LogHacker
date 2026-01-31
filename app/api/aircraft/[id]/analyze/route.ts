import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Aircraft from '@/lib/models/Aircraft';
import ParsedDocument from '@/lib/models/ParsedDocument';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();
        const { id } = params;

        const aircraft = await Aircraft.findById(id);
        if (!aircraft) {
            return NextResponse.json(
                { success: false, error: 'Aircraft not found' },
                { status: 404 }
            );
        }

        // 1. Fetch Maintenance Logs
        // We look for documents linked to this aircraft that are maintenance logs
        const linkedDocs = await ParsedDocument.find({
            $or: [
                { _id: { $in: aircraft.linkedDocuments || [] } },
                { aircraft: id }
            ],
            documentType: 'maintenance',
            status: 'completed'
        });

        // 2. Aggregate Entries
        const allEntries: any[] = [];
        linkedDocs.forEach(doc => {
            if (doc.entries && Array.isArray(doc.entries)) {
                allEntries.push(...doc.entries);
            }
        });

        // Sort by Date (desc) and Hobbs (desc) to find latest
        allEntries.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            return (b.hobbsTime || 0) - (a.hobbsTime || 0);
        });

        // 3. Analyze Components
        const componentsToCheck = [
            { key: 'magneto', label: 'Magnetos' },
            { key: 'vacuum pump', label: 'Vacuum Pump' },
            { key: 'cylinder', label: 'Cylinders' },
            { key: 'oil change', label: 'Oil Change' },
            { key: 'annual', label: 'Annual Inspection' },
            { key: 'elt', label: 'ELT Battery' }
        ];

        const currentHobbs = aircraft.currentHours.hobbs;
        const findings: { component: string; status: 'ok' | 'warning' | 'critical'; message: string; lastMentioned?: Date }[] = [];
        let score = 10; // Perfect score

        for (const comp of componentsToCheck) {
            // Find latest mention
            const latestEntry = allEntries.find(entry =>
                (entry.description || '').toLowerCase().includes(comp.key)
            );

            if (latestEntry) {
                let hoursSince = -1;
                if (latestEntry.hobbsTime) {
                    hoursSince = currentHobbs - latestEntry.hobbsTime;
                }

                // Logic for Warnings
                // Magneto: 500 hrs
                // Vacuum Pump: 500 hrs (often replaced at 500-1000)
                // Cylinder: monitor?
                // Oil: 50 hrs

                if (comp.key === 'magneto' || comp.key === 'vacuum pump') {
                    if (hoursSince > 500) {
                        score -= 2;
                        findings.push({
                            component: comp.label,
                            status: 'warning',
                            message: `Last mentioned ${hoursSince.toFixed(1)} hours ago. Recommended inspection/replacement every 500 hours.`,
                            lastMentioned: latestEntry.date
                        });
                    } else {
                        findings.push({
                            component: comp.label,
                            status: 'ok',
                            message: `Serviced ${hoursSince > 0 ? hoursSince.toFixed(1) + ' hours ago' : 'recently'}.`,
                            lastMentioned: latestEntry.date
                        });
                    }
                } else if (comp.key === 'oil change') {
                    if (hoursSince > 60) {
                        score -= 1;
                        findings.push({
                            component: comp.label,
                            status: 'warning',
                            message: `Last oil change ${hoursSince.toFixed(1)} hours ago. Recommended every 50 hours.`,
                            lastMentioned: latestEntry.date
                        });
                    } else {
                        findings.push({
                            component: comp.label,
                            status: 'ok',
                            message: `Oil changed ${hoursSince > 0 ? hoursSince.toFixed(1) + ' hours ago' : 'recently'}.`,
                            lastMentioned: latestEntry.date
                        });
                    }
                } else {
                    // Generic found
                    findings.push({
                        component: comp.label,
                        status: 'ok',
                        message: `Found in records from ${latestEntry.date || 'unknown date'}.`,
                        lastMentioned: latestEntry.date
                    });
                }

            } else {
                // Not found
                if (comp.key === 'annual') {
                    // Use aircraft maintenanceDates if not found in logs
                    // But here we are analyzing logs.
                    // Assume if not in logs, it's a data gap.
                    findings.push({
                        component: comp.label,
                        status: 'warning',
                        message: `No record found in uploaded logs. Check airframe logbook.`,
                    });
                } else {
                    score -= 1;
                    findings.push({
                        component: comp.label,
                        status: 'warning',
                        message: `No mention found in analyzed maintenance logs.`,
                    });
                }
            }
        }

        // 4. Update Aircraft
        aircraft.safetyAnalysis = {
            lastAnalyzed: new Date(),
            score: Math.max(0, score),
            findings: findings
        };

        await aircraft.save();

        return NextResponse.json({ success: true, data: aircraft.safetyAnalysis });

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
