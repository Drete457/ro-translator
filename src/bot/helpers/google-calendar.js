const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

class GoogleCalendarHelper {
    constructor(serviceAccountEmail, privateKey, calendarId) {
        this.calendarId = calendarId;
        this.auth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });
        this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    }

    /**
     * Create a new calendar event
     * @param {string} title - Event title
     * @param {Date} startDate - Event start date
     * @param {Date} endDate - Event end date
     * @param {string} description - Event description
     * @param {string} location - Event location (optional)
     * @param {Array} attendees - Array of email addresses (optional)
     * @returns {Promise<Object>} Created event object
     */
    async createEvent(title, startDate, endDate, description = '', location = '', attendees = []) {
        try {
            const event = {
                summary: title,
                description: description,
                location: location,
                start: {
                    dateTime: startDate.toISOString(),
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: endDate.toISOString(),
                    timeZone: 'UTC'
                },
                attendees: attendees.map(email => ({ email })),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 60 },
                        { method: 'popup', minutes: 10 }
                    ]
                }
            };

            const response = await this.calendar.events.insert({
                calendarId: this.calendarId,
                resource: event,
                sendUpdates: 'all'
            });

            return {
                success: true,
                event: response.data,
                eventId: response.data.id,
                htmlLink: response.data.htmlLink
            };
        } catch (error) {
            console.error('Error creating calendar event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse date string in various formats to Date object
     * @param {string} dateStr - Date string
     * @param {string} timeStr - Time string (optional)
     * @returns {Date} Parsed date
     */
    parseDate(dateStr, timeStr = '12:00') {
        // Try different date formats
        const formats = [
            // DD/MM/YYYY or DD-MM-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // MM/DD/YYYY or MM-DD-YYYY
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
            // YYYY/MM/DD or YYYY-MM-DD
            /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/
        ];

        let day, month, year;
        
        // Check DD/MM/YYYY format first (European style)
        const ddmmMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmMatch) {
            day = parseInt(ddmmMatch[1]);
            month = parseInt(ddmmMatch[2]) - 1; // JavaScript months are 0-indexed
            year = parseInt(ddmmMatch[3]);
        } else {
            // Try YYYY-MM-DD format
            const yyyymmMatch = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
            if (yyyymmMatch) {
                year = parseInt(yyyymmMatch[1]);
                month = parseInt(yyyymmMatch[2]) - 1;
                day = parseInt(yyyymmMatch[3]);
            } else {
                throw new Error('Invalid date format. Use DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD');
            }
        }

        // Parse time
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        let hours = 12, minutes = 0;
        if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
        }

        return new Date(year, month, day, hours, minutes);
    }

    /**
     * Quick event creation for gaming events
     * @param {string} eventType - Type of event (war, rally, etc.)
     * @param {string} dateStr - Date string
     * @param {string} timeStr - Time string
     * @param {number} durationHours - Event duration in hours
     * @param {string} additionalInfo - Additional information
     * @returns {Promise<Object>} Created event object
     */
    async createGameEvent(eventType, dateStr, timeStr, durationHours = 1, additionalInfo = '') {
        const eventTypes = {
            'war': {
                title: '⚔️ ICE Clan War',
                description: 'ICE Clan war event. All active members should participate!'
            },
            'rally': {
                title: '🏰 Rally Event',
                description: 'Rally event for ICE Clan. Join the rally and help the clan!'
            },
            'kvk': {
                title: '👑 Kingdom vs Kingdom',
                description: 'KvK event! Time to show our strength!'
            },
            'training': {
                title: '📚 Training Session',
                description: 'Clan training session. Improve your skills!'
            },
            'meeting': {
                title: '🗣️ Leadership Meeting',
                description: 'ICE Clan leadership meeting.'
            }
        };

        const eventConfig = eventTypes[eventType.toLowerCase()] || {
            title: `🎮 ${eventType}`,
            description: `ICE Clan ${eventType} event`
        };

        const startDate = this.parseDate(dateStr, timeStr);
        const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000));

        const description = `${eventConfig.description}\n\n${additionalInfo}\n\n📅 Scheduled by Leroy Jenkins Bot\n🕐 Duration: ${durationHours} hour(s)`;

        return await this.createEvent(
            eventConfig.title,
            startDate,
            endDate,
            description
        );
    }
}

module.exports = GoogleCalendarHelper;
