const parseTime = (timeString) => {
  if (!timeString) return null;
  let totalMilliseconds = 0;
  const timePattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;
  const match = timeString.match(timePattern);

  if (!match || timeString !== match[0] || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) {
    return null;
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;

  totalMilliseconds += hours * 60 * 60 * 1000;
  totalMilliseconds += minutes * 60 * 1000;
  totalMilliseconds += seconds * 1000;

  return totalMilliseconds > 0 ? totalMilliseconds : null;
}

const formatDuration = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export { parseTime, formatDuration };