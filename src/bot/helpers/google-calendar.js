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
     * Get upcoming events from the calendar
     * @param {number} daysAhead - Number of days to look ahead
     * @returns {Promise<Array>} Array of events
     */
    async getUpcomingEvents(daysAhead = 15) {
        try {
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            const response = await this.calendar.events.list({
                calendarId: this.calendarId,
                timeMin: now.toISOString(),
                timeMax: futureDate.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });

            return {
                success: true,
                events: response.data.items || []
            };
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            return {
                success: false,
                error: error.message,
                events: []
            };
        }
    }

    /**
     * Get a specific event by ID
     * @param {string} eventId - The event ID
     * @returns {Promise<Object>} Event object
     */
    async getEvent(eventId) {
        try {
            const response = await this.calendar.events.get({
                calendarId: this.calendarId,
                eventId: eventId
            });

            return {
                success: true,
                event: response.data
            };
        } catch (error) {
            console.error('Error fetching event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete an event by ID
     * @param {string} eventId - The event ID
     * @returns {Promise<Object>} Result object
     */
    async deleteEvent(eventId) {
        try {
            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: eventId
            });

            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update an event
     * @param {string} eventId - The event ID
     * @param {Object} updates - The updates to apply
     * @returns {Promise<Object>} Result object
     */
    async updateEvent(eventId, updates) {
        try {
            const response = await this.calendar.events.patch({
                calendarId: this.calendarId,
                eventId: eventId,
                resource: updates
            });

            return {
                success: true,
                event: response.data
            };
        } catch (error) {
            console.error('Error updating event:', error);
            return {
                success: false,
                error: error.message
            };
        }
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
    async createEvent(summary, startDate, endDate, description = '', location = '', attendees = []) {
        try {
            const event = {
                summary: summary,
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

            const formatDate = (date) => {
                return date.toLocaleDateString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            };

            const formatTime = (date) => {
                return date.toLocaleTimeString('pt-PT', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            const duration = Math.round((endDate - startDate) / (1000 * 60 * 60) * 100) / 100; 

            return {
                success: true,
                event: response.data,
                eventId: response.data.id,
                htmlLink: response.data.htmlLink,
                eventDetails: {
                    date: formatDate(startDate),
                    time: formatTime(startDate),
                    duration: duration >= 1 ? 
                        `${Math.floor(duration)}h${duration % 1 > 0 ? Math.round((duration % 1) * 60) + 'm' : ''}` : 
                        `${Math.round(duration * 60)}m`,
                    link: response.data.htmlLink || 'N/A'
                }
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
     * Parse duration string to hours
     * @param {string} durationStr - Duration string (e.g., "2h", "1h30m", "45m")
     * @returns {number} Duration in hours
     */
    parseDuration(durationStr) {
        if (typeof durationStr === 'number') {
            return durationStr;
        }
        
        const str = durationStr.toLowerCase().trim();
        let totalHours = 0;
        
        // Match hours (e.g., "2h", "1h")
        const hoursMatch = str.match(/(\d+)h/);
        if (hoursMatch) {
            totalHours += parseInt(hoursMatch[1]);
        }
        
        // Match minutes (e.g., "30m", "45m")
        const minutesMatch = str.match(/(\d+)m/);
        if (minutesMatch) {
            totalHours += parseInt(minutesMatch[1]) / 60;
        }
        
        // If no match found, try to parse as plain number
        if (totalHours === 0) {
            const numMatch = str.match(/(\d+)/);
            if (numMatch) {
                totalHours = parseInt(numMatch[1]);
            }
        }
        
        return totalHours || 1; // Default to 1 hour if parsing fails
    }

    /**
     * Quick event creation for gaming events
     * @param {string} eventType - Type of event (war, rally, etc.)
     * @param {string} dateStr - Date string
     * @param {string} timeStr - Time string
     * @param {string|number} durationStr - Event duration (e.g., "2h", "1h30m")
     * @param {string} additionalInfo - Additional information
     * @returns {Promise<Object>} Created event object
     */
    async createGameEvent(eventType, dateStr, timeStr, durationStr = 1, additionalInfo = '') {
        const eventTypes = {
            'war': {
                title: '⚔️ FTS Clan War',
                description: 'FTS Clan war event. All active members should participate!'
            },
            'rally': {
                title: '🏰 Rally Event',
                description: 'Rally event for FTS Clan. Join the rally and help the clan!'
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
                description: 'FTS Clan leadership meeting.'
            },
            'custom': {
                title: '📅 Custom Event',
                description: 'Custom event for FTS Clan.'
            }
        };

        const eventConfig = eventTypes[eventType.toLowerCase()] || {
            title: `🎮 ${eventType}`,
            description: `FTS Clan ${eventType} event`
        };

        // For custom events, use the additional info as the title if provided
        let finalTitle = eventConfig.title;
        let finalDescription = eventConfig.description;
        
        if (eventType.toLowerCase() === 'custom' && additionalInfo) {
            const lines = additionalInfo.split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                finalTitle = lines[0].trim();
                finalDescription = lines.slice(1).join('\n').trim() || eventConfig.description;
            }
        }

        const startDate = this.parseDate(dateStr, timeStr);
        const durationHours = this.parseDuration(durationStr);
        const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000));

        const description = eventType.toLowerCase() === 'custom' ? 
            `${finalDescription}\n\n📅 Scheduled by Leroy Jenkins Bot\n⏱️ Duration: ${durationStr}` :
            `${eventConfig.description}\n\n${additionalInfo}\n\n📅 Scheduled by Leroy Jenkins Bot\n⏱️ Duration: ${durationStr}`;

        return await this.createEvent(
            finalTitle,
            startDate,
            endDate,
            description
        );
    }
}

module.exports = GoogleCalendarHelper;
