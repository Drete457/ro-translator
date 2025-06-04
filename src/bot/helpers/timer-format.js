
const parseDurationToSeconds = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return null;

    let totalSeconds = 0;
    const cleanedTimeString = timeString.toLowerCase();
    let remainingString = cleanedTimeString;
    let found = false;

    const hourMatch = remainingString.match(/(\d+)h/);
    if (hourMatch) {
        totalSeconds += parseInt(hourMatch[1]) * 3600;
        remainingString = remainingString.replace(hourMatch[0], '');
        found = true;
    }

    const minuteMatch = remainingString.match(/(\d+)m/);
    if (minuteMatch) {
        totalSeconds += parseInt(minuteMatch[1]) * 60;
        remainingString = remainingString.replace(minuteMatch[0], '');
        found = true;
    }

    const secondMatch = remainingString.match(/(\d+)s/);
    if (secondMatch) {
        totalSeconds += parseInt(secondMatch[1]);
        remainingString = remainingString.replace(secondMatch[0], '');
        found = true;
    }

    if (remainingString.length > 0 || !found || totalSeconds <= 0) {
        return null;
    }

    return totalSeconds;
}

const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}

export {
    parseDurationToSeconds,
    formatTime
}