// Time utilities for relative and formatted dates

/**
 * Format date as relative time (e.g., "před 5 minutami", "2 days ago")
 */
export function timeAgo(date, locale = 'en') {
	if (!date) return '';
	
	const now = new Date();
	const past = new Date(date);
	const diffMs = now - past;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);
	const diffWeek = Math.floor(diffDay / 7);
	const diffMonth = Math.floor(diffDay / 30);
	const diffYear = Math.floor(diffDay / 365);

	const translations = {
		en: {
			justNow: 'just now',
			secondsAgo: (n) => `${n} second${n !== 1 ? 's' : ''} ago`,
			minutesAgo: (n) => `${n} minute${n !== 1 ? 's' : ''} ago`,
			hoursAgo: (n) => `${n} hour${n !== 1 ? 's' : ''} ago`,
			daysAgo: (n) => `${n} day${n !== 1 ? 's' : ''} ago`,
			weeksAgo: (n) => `${n} week${n !== 1 ? 's' : ''} ago`,
			monthsAgo: (n) => `${n} month${n !== 1 ? 's' : ''} ago`,
			yearsAgo: (n) => `${n} year${n !== 1 ? 's' : ''} ago`
		},
		cs: {
			justNow: 'právě teď',
			secondsAgo: (n) => `před ${n} ${n === 1 ? 'sekundou' : n < 5 ? 'sekundami' : 'sekundami'}`,
			minutesAgo: (n) => `před ${n} ${n === 1 ? 'minutou' : n < 5 ? 'minutami' : 'minutami'}`,
			hoursAgo: (n) => `před ${n} ${n === 1 ? 'hodinou' : n < 5 ? 'hodinami' : 'hodinami'}`,
			daysAgo: (n) => `před ${n} ${n === 1 ? 'dnem' : 'dny'}`,
			weeksAgo: (n) => `před ${n} ${n === 1 ? 'týdnem' : 'týdny'}`,
			monthsAgo: (n) => `před ${n} ${n === 1 ? 'měsícem' : 'měsíci'}`,
			yearsAgo: (n) => `před ${n} ${n === 1 ? 'rokem' : 'roky'}`
		},
		de: {
			justNow: 'gerade eben',
			secondsAgo: (n) => `vor ${n} Sekunde${n !== 1 ? 'n' : ''}`,
			minutesAgo: (n) => `vor ${n} Minute${n !== 1 ? 'n' : ''}`,
			hoursAgo: (n) => `vor ${n} Stunde${n !== 1 ? 'n' : ''}`,
			daysAgo: (n) => `vor ${n} Tag${n !== 1 ? 'en' : ''}`,
			weeksAgo: (n) => `vor ${n} Woche${n !== 1 ? 'n' : ''}`,
			monthsAgo: (n) => `vor ${n} Monat${n !== 1 ? 'en' : ''}`,
			yearsAgo: (n) => `vor ${n} Jahr${n !== 1 ? 'en' : ''}`
		}
	};

	const t = translations[locale] || translations.en;

	if (diffSec < 10) return t.justNow;
	if (diffSec < 60) return t.secondsAgo(diffSec);
	if (diffMin < 60) return t.minutesAgo(diffMin);
	if (diffHour < 24) return t.hoursAgo(diffHour);
	if (diffDay < 7) return t.daysAgo(diffDay);
	if (diffWeek < 4) return t.weeksAgo(diffWeek);
	if (diffMonth < 12) return t.monthsAgo(diffMonth);
	return t.yearsAgo(diffYear);
}

/**
 * Format date with time (e.g., "4. 1. 2026 14:30")
 */
export function formatDateTime(date, locale = 'en') {
	if (!date) return '';
	
	const d = new Date(date);
	return d.toLocaleString(locale, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format date only (e.g., "4. 1. 2026")
 */
export function formatDate(date, locale = 'en') {
	if (!date) return '';
	
	const d = new Date(date);
	return d.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	});
}
