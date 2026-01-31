import { Resend } from 'resend';
import { IFlight } from '../models/Flight';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface EmailResult {
  success: boolean;
  message: string;
  id?: string;
}

export async function sendAuditEmail(flight: IFlight): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend API key not configured - email not sent');
    return {
      success: false,
      message: 'Email service not configured',
    };
  }

  const pilot = flight.pilot as any;
  const aircraft = flight.aircraft as any;

  if (!pilot?.email) {
    return {
      success: false,
      message: 'Pilot email not found',
    };
  }

  const statusEmoji =
    flight.overallStatus === 'go'
      ? '✅'
      : flight.overallStatus === 'caution'
        ? '⚠️'
        : '❌';

  const statusText =
    flight.overallStatus === 'go'
      ? 'GO - Flight Approved'
      : flight.overallStatus === 'caution'
        ? 'CAUTION - Review Required'
        : 'NO-GO - Flight Not Recommended';

  // Build check summary
  const checkSummary = flight.legalityChecks
    .map((check) => {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      return `${icon} ${check.item}: ${check.message}`;
    })
    .join('\n');

  // Weather summary
  const weatherSummary = flight.weather
    ? `
Weather at ${flight.weather.station}:
- Conditions: ${flight.weather.flightCategory}
- Visibility: ${flight.weather.visibility} SM
- Wind: ${flight.weather.wind.direction}° at ${flight.weather.wind.speed} kts${flight.weather.wind.gust ? ` G${flight.weather.wind.gust}` : ''
    }
${flight.weather.ceiling ? `- Ceiling: ${flight.weather.ceiling} ft` : ''}
`
    : 'Weather data not available';

  const emailBody = `
Aviation Intelligence Brain - Flight Safety Audit Report
═══════════════════════════════════════════════════════════

${statusEmoji} OVERALL STATUS: ${statusText}

Flight Details:
───────────────────────────────────────────────────────────
Pilot: ${pilot.name}
Aircraft: ${aircraft.tailNumber} (${aircraft.model})
Date: ${new Date(flight.scheduledDate).toLocaleDateString()}
Departure: ${flight.departureAirport}
${flight.arrivalAirport ? `Arrival: ${flight.arrivalAirport}` : ''}

Legality Checks:
───────────────────────────────────────────────────────────
${checkSummary}

${weatherSummary}

═══════════════════════════════════════════════════════════
This is an automated safety briefing from Aviation Intelligence Brain.
Always verify information independently before flight.
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: 'Aviation Intelligence <safety@yourdomain.com>',
      to: [pilot.email],
      subject: `${statusEmoji} Flight Audit: ${aircraft.tailNumber} - ${statusText}`,
      text: emailBody,
    });

    if (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message: 'Email sent successfully',
      id: data?.id,
    };
  } catch (error) {
    console.error('Email service error:', error);
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

// Generate HTML version of the audit report
export function generateAuditHTML(flight: IFlight): string {
  const pilot = flight.pilot as any;
  const aircraft = flight.aircraft as any;

  const statusColor =
    flight.overallStatus === 'go'
      ? '#10b981'
      : flight.overallStatus === 'caution'
        ? '#f59e0b'
        : '#ef4444';

  const statusText =
    flight.overallStatus === 'go'
      ? 'GO - Flight Approved'
      : flight.overallStatus === 'caution'
        ? 'CAUTION - Review Required'
        : 'NO-GO - Flight Not Recommended';

  const checksHTML = flight.legalityChecks
    .map((check) => {
      const color =
        check.status === 'pass' ? '#10b981' : check.status === 'warning' ? '#f59e0b' : '#ef4444';
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
          ${check.item}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${check.message}</td>
      </tr>
    `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Flight Audit Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px;">${statusText}</h1>
  </div>

  <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">Flight Details</h2>
    <p style="margin: 4px 0;"><strong>Pilot:</strong> ${pilot?.name || 'N/A'}</p>
    <p style="margin: 4px 0;"><strong>Aircraft:</strong> ${aircraft?.tailNumber || 'N/A'} (${aircraft?.model || 'N/A'})</p>
    <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(flight.scheduledDate).toLocaleDateString()}</p>
    <p style="margin: 4px 0;"><strong>Departure:</strong> ${flight.departureAirport}</p>
  </div>

  <h2 style="font-size: 18px;">Legality Checks</h2>
  <table style="width: 100%; border-collapse: collapse;">
    ${checksHTML}
  </table>

  <p style="color: #6b7280; font-size: 12px; margin-top: 20px; text-align: center;">
    This is an automated safety briefing from Aviation Intelligence Brain.
    Always verify information independently before flight.
  </p>
</body>
</html>
  `;
}

export async function sendThreatAlert(email: string, flight: IFlight, threats: string[]): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend API key not configured - threat alert not sent');
    return { success: false, message: 'Email service not configured' };
  }

  const aircraft = flight.aircraft as any;
  const threatList = threats.map(t => `- ${t}`).join('\n');

  const emailBody = `
⚠️ URGENT: Flight Status Changed to NO-GO
═══════════════════════════════════════════════════════════

New threats have been detected for your upcoming flight:

Flight Details:
Aircraft: ${aircraft?.tailNumber || 'Unknown'}
Departure: ${flight.departureAirport}
Date: ${new Date(flight.scheduledDate).toLocaleDateString()}

DETECTED THREATS:
───────────────────────────────────────────────────────────
${threatList}

Please review your flight plan immediately.
═══════════════════════════════════════════════════════════
`.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: 'Aviation Intelligence <safety@yourdomain.com>',
      to: [email],
      subject: `⚠️ THREAT ALERT: Flight ${aircraft?.tailNumber || ''} Status Changed`,
      text: emailBody,
    });

    if (error) {
      console.error('Threat email error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Threat alert sent', id: data?.id };
  } catch (error) {
    console.error('Threat email service error:', error);
    return { success: false, message: (error as Error).message };
  }
}
