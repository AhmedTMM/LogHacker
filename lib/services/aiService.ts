import { GoogleGenerativeAI } from '@google/generative-ai';

interface PilotData {
    name: string;
    experience: any;
    certificates: any;
    flightEntries: any[];
}

export async function analyzePilotSafety(pilot: PilotData) {
    // 1. Prepare Data Context
    // We want to minimize token usage while giving enough context.
    // Extract last 20 flights or significant ones? Let's take last 30 for trend analysis.
    // Also extract unique airports to give regional context.

    const recentFlights = (pilot.flightEntries || [])
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30)
        .map((f: any) => ({
            date: f.date,
            departure: f.departure,
            arrival: f.arrival,
            duration: f.totalTime,
            remarks: f.remarks,
            conditions: f.isInstrument ? 'IFR' : 'VFR', // heuristic
            night: f.night > 0
        }));

    const uniqueAirports = Array.from(new Set([
        ...recentFlights.map((f: any) => f.departure),
        ...recentFlights.map((f: any) => f.arrival)
    ])).filter(Boolean).join(', ');

    const systemInstruction = `You are a Chief Flight Instructor conducting a comprehensive safety review. 
Analyze the pilot's logbook data to identify ANY potential risk factors. Do not limit yourself to specific categories if others are more relevant.

Common risk areas to consider (but do not feel limited to):
1. Seasonality: Winter operations, summer density altitude, etc.
2. Region/Terrain: Mountainous, complex airspace, coastal, flatland, etc.
3. Proficiency: Currency, frequency, variety of aircraft.
4. Logbook Integrity: Suspicious entries, lack of instructor endorsements for student pilots, "padding" hours.
5. Progression: Stagnation, rushing ratings, or gaps in training.

Output a VALID JSON object with this exact structure:
{
  "risk_factors": [
    {
      "category": "string (e.g. 'Seasonality', 'Logbook Integrity')",
      "riskLevel": "high" | "medium" | "low",
      "message": "concise description of the risk"
    }
  ],
  "overall_assessment": {
    "score": number (1-10, where 10 is highest risk),
    "summary": "concise overall summary"
  }
}
Do not include markdown formatting like \`\`\`json. Just the raw JSON string.`;

    const userPrompt = `
Pilot: ${pilot.name}
Total Time: ${pilot.experience.totalHours} hrs
Certificates: ${JSON.stringify(pilot.certificates)}

Recent Activity (Last 30 flights):
${JSON.stringify(recentFlights, null, 2)}

Operating Airports: ${uniqueAirports}
`;

    try {
        if (!process.env.GEMINI_API_KEY) {
            // Development/Build safe fallback checks
            throw new Error("Missing GEMINI_API_KEY");
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const text = response.text();

        // Cleanup potential markdown formatting if model ignores instruction
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error("AI returned invalid JSON:", text);
            return {
                risk_factors: [{ category: "System", risk_level: "low", description: "Raw analysis: " + text }],
                overall_assessment: { score: 0, summary: "Could not parse structured analysis." }
            };
        }

    } catch (error) {
        console.error("AI Analysis Error:", error);
        throw new Error("Failed to generate AI safety analysis");
    }
}
