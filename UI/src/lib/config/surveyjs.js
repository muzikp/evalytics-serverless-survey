// SurveyJS version configuration
// Update this list when new SurveyJS versions are released
// Check: https://www.npmjs.com/package/survey-core for latest versions

export const SURVEYJS_VERSIONS = [
	{ value: '1.12.8', label: '1.12.8 (Latest Stable)', isLatest: true, isProduction: true },
	{ value: '1.12.7', label: '1.12.7', isProduction: true },
	{ value: '1.12.6', label: '1.12.6', isProduction: true },
	{ value: '1.11.10', label: '1.11.10', isProduction: true },
	{ value: '1.11.9', label: '1.11.9', isProduction: true },
	{ value: '1.10.10', label: '1.10.10', isProduction: false },
	{ value: '1.9.116', label: '1.9.116 (Legacy)', isProduction: false }
];

// Get latest production version
export function getLatestProductionVersion() {
	return SURVEYJS_VERSIONS.find(v => v.isLatest && v.isProduction)?.value || SURVEYJS_VERSIONS[0].value;
}

// Get production versions only
export function getProductionVersions() {
	return SURVEYJS_VERSIONS.filter(v => v.isProduction);
}

// Available form languages with names
export const FORM_LANGUAGES = [
	{ code: 'cs', name: 'Čeština', flag: '🇨🇿' },
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];
