import Flight, { IFlight, ILegalityCheck, IWeatherData } from '../models/Flight';
import Pilot, { IPilot } from '../models/Pilot';
import { fetchWeatherData } from './weatherService';
import { sendThreatAlert } from './emailService';

export interface ThreatAnalysisResult {
    hasThreats: boolean;
    threats: string[];
    newStatus: 'go' | 'caution' | 'no-go';
}

export async function analyzeFlight(flightId: string, weatherOverride?: IWeatherData): Promise<ThreatAnalysisResult> {
    const flight = await Flight.findById(flightId).populate('pilot').exec();

    if (!flight) {
        throw new Error('Flight not found');
    }

    const pilot = flight.pilot as unknown as IPilot;
    const threats: string[] = [];
    let newStatus: 'go' | 'caution' | 'no-go' = 'go';

    // 1. Fetch Weather
    const weather = weatherOverride || await fetchWeatherData(flight.departureAirport);

    if (weather) {
        // Save weather to flight
        flight.weather = weather;

        // 2. Analyze Conditions

        // IFR Check
        const isIFR = weather.flightCategory === 'IFR' || weather.flightCategory === 'LIFR';

        if (isIFR) {
            if (!pilot.certificates.instrumentRated) {
                threats.push(`CRITICAL: IFR conditions at ${flight.departureAirport} (${weather.flightCategory}) but pilot is not Instrument Rated.`);
                newStatus = 'no-go';
            } else {
                threats.push(`NOTICE: IFR conditions at ${flight.departureAirport}.`);
                if (newStatus === 'go') newStatus = 'caution';
            }
        }

        // Wind Check
        const windSpeed = weather.wind.speed;
        const windGust = weather.wind.gust || 0;

        if (windSpeed > 30 || windGust > 30) {
            threats.push(`WARNING: High winds at ${flight.departureAirport} (${windSpeed}G${windGust}kt).`);
            if (newStatus !== 'no-go') newStatus = 'no-go';
        } else if (windSpeed > 20 || windGust > 20) {
            threats.push(`CAUTION: Moderate winds at ${flight.departureAirport} (${windSpeed}kts).`);
            if (newStatus === 'go') newStatus = 'caution';
        }

        // 3. Update Flight Status & Checks
        flight.overallStatus = newStatus;

        // Remove old safety checks to avoid duplicates (naive approach, better to update)
        flight.legalityChecks = flight.legalityChecks.filter(c => c.category !== 'safety');

        threats.forEach(msg => {
            flight.legalityChecks.push({
                category: 'safety',
                item: 'Weather Threat',
                status: msg.includes('CRITICAL') || msg.includes('WARNING') ? 'fail' : 'warning',
                message: msg,
                details: `Analyzed at ${new Date().toISOString()}`
            });
        });

        await flight.save();

        // 4. Notify if severe threats
        if (newStatus === 'no-go' && !flight.emailSent) { // Avoid spamming? Logic might need refinement
            // For now, we alert on any new No-Go. 
            // Ideally we check if we already alerted for *this specific* threat.
            // But simpler: just alert. User asked for system that considers threats.
            await sendThreatAlert(pilot.email, flight, threats);
            flight.emailSent = true;
            await flight.save();
        }
    }

    return {
        hasThreats: threats.length > 0,
        threats,
        newStatus
    };
}
