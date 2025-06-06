const analyzePlayerTimezones = (players) => {
    const playersWithTimezone = players.filter(player => 
        player.timeZone && 
        player.timeZone.trim() !== '' && 
        player.timeZone !== 'Unknown'
    );

    if (playersWithTimezone.length === 0) {
        return {
            totalPlayers: players.length,
            playersWithTimezone: 0,
            timezoneDistribution: {},
            optimalTimes: [],
            recommendations: ['No timezone data available for analysis.']
        };
    }

    const timezoneCount = {};
    playersWithTimezone.forEach(player => {
        const tz = normalizeTimezone(player.timeZone);
        timezoneCount[tz] = (timezoneCount[tz] || 0) + 1;
    });

    const sortedTimezones = Object.entries(timezoneCount)
        .sort(([,a], [,b]) => b - a);

    const optimalTimes = calculateOptimalTimes(timezoneCount);

    const recommendations = generateRecommendations(sortedTimezones, optimalTimes, playersWithTimezone.length);

    return {
        totalPlayers: players.length,
        playersWithTimezone: playersWithTimezone.length,
        timezoneDistribution: timezoneCount,
        optimalTimes,
        recommendations,
        topTimezones: sortedTimezones.slice(0, 5)
    };
}

const normalizeTimezone = (timezone) => {
    const tz = timezone.trim().toUpperCase();
    
    const timezoneMap = {
        'UTC': 'UTC+0',
        'GMT': 'UTC+0',
        'EST': 'UTC-5',
        'CST': 'UTC-6',
        'MST': 'UTC-7',
        'PST': 'UTC-8',
        'BST': 'UTC+1',
        'CET': 'UTC+1',
        'EET': 'UTC+2',
        'IST': 'UTC+5:30',
        'JST': 'UTC+9',
        'AEST': 'UTC+10',
        'NZST': 'UTC+12'
    };

    if (tz.startsWith('UTC')) {
        return tz;
    }

    if (timezoneMap[tz]) {
        return timezoneMap[tz];
    }

    const utcMatch = tz.match(/([+-]\d{1,2}):?(\d{0,2})/);
    if (utcMatch) {
        const hours = utcMatch[1];
        const minutes = utcMatch[2] || '00';
        return `UTC${hours}${minutes !== '00' ? ':' + minutes : ''}`;
    }

    return tz;
}

const calculateOptimalTimes = (timezoneCount) => {
    const timeSlots = {}; 
    
    Object.entries(timezoneCount).forEach(([timezone, count]) => {
        const offset = parseTimezoneOffset(timezone);
        if (offset !== null) {
            for (let localHour = 18; localHour <= 23; localHour++) {
                const utcHour = (localHour - offset + 24) % 24;
                timeSlots[utcHour] = (timeSlots[utcHour] || 0) + count;
            }
        }
    });

    const sortedSlots = Object.entries(timeSlots)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count);

    return sortedSlots.slice(0, 3).map(slot => ({
        utcTime: `${slot.hour.toString().padStart(2, '0')}:00 UTC`,
        activePlayersCount: slot.count,
        localTimes: generateLocalTimes(slot.hour, timezoneCount)
    }));
}

const parseTimezoneOffset = (timezone) => {
    const match = timezone.match(/UTC([+-])(\d{1,2}):?(\d{0,2})/);
    if (!match) return null;
    
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2]);
    const minutes = parseInt(match[3] || '0');
    
    return sign * (hours + minutes / 60);
}

const generateLocalTimes = (utcHour, timezoneCount) => {
    const localTimes = [];
    
    Object.keys(timezoneCount).forEach(timezone => {
        const offset = parseTimezoneOffset(timezone);
        if (offset !== null) {
            const localHour = (utcHour + offset + 24) % 24;
            localTimes.push(`${localHour.toString().padStart(2, '0')}:00 ${timezone}`);
        }
    });

    return localTimes.sort();
}

const generateRecommendations = (sortedTimezones, optimalTimes, totalPlayersWithTz) => {
    const recommendations = [];
    
    if (sortedTimezones.length === 0) {
        return ['No timezone data available for recommendations.'];
    }

    const topTimezone = sortedTimezones[0];
    const topPercentage = Math.round((topTimezone[1] / totalPlayersWithTz) * 100);
    
    if (topPercentage > 50) {
        recommendations.push(`🌍 **Majority timezone**: ${topTimezone[1]} players (${topPercentage}%) are in ${topTimezone[0]}`);
    } else {
        recommendations.push(`🌍 **Distributed timezones**: Players are spread across multiple timezones, with ${topTimezone[0]} having the most (${topTimezone[1]} players)`);
    }

    if (optimalTimes.length > 0) {
        const bestTime = optimalTimes[0];
        recommendations.push(`⏰ **Best coordination time**: ${bestTime.utcTime} (${bestTime.activePlayersCount} players likely active)`);
        
        if (optimalTimes.length > 1) {
            const secondBest = optimalTimes[1];
            recommendations.push(`⏰ **Alternative time**: ${secondBest.utcTime} (${secondBest.activePlayersCount} players likely active)`);
        }
    }

    if (sortedTimezones.length > 3) {
        recommendations.push(`📋 **Strategy**: Consider organizing events in multiple time windows to accommodate all ${sortedTimezones.length} different timezones`);
    }

    return recommendations;
}

module.exports = {
    analyzePlayerTimezones,
    normalizeTimezone,
    calculateOptimalTimes,
    parseTimezoneOffset
};
