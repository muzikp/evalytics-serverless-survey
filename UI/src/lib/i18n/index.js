// Internationalization utilities
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Available languages
export const languages = {
	cs: 'Čeština',
	en: 'English',
	de: 'Deutsch'
};

// Detect browser language
function detectLanguage() {
	if (!browser) return 'en';
	
	const stored = localStorage.getItem('language');
	if (stored && languages[stored]) return stored;
	
	const browserLang = navigator.language.split('-')[0];
	return languages[browserLang] ? browserLang : 'en';
}

// Create language store
function createLanguageStore() {
	const { subscribe, set } = writable(detectLanguage());
	
	return {
		subscribe,
		set: (lang) => {
			if (browser) {
				localStorage.setItem('language', lang);
			}
			set(lang);
		}
	};
}

export const currentLanguage = createLanguageStore();

// Translation function
export function t(key, lang) {
	const translations = getTranslations(lang);
	return translations[key] || key;
}

// Get translations for language
function getTranslations(lang) {
	try {
		return translations[lang] || translations.en;
	} catch {
		return {};
	}
}

// Translations object
const translations = {
	en: {
		// Common
		'app.name': 'Evalytics Survey',
		'common.save': 'Save',
		'common.cancel': 'Cancel',
		'common.delete': 'Delete',
		'common.edit': 'Edit',
		'common.create': 'Create',
		'common.back': 'Back',
		'common.loading': 'Loading...',
		'common.saving': 'Saving...',
		'common.search': 'Search',
		'common.filter': 'Filter',
		
		// Auth
		'auth.login': 'Login',
		'auth.logout': 'Logout',
		'auth.email': 'Email',
		'auth.password': 'Password',
		
		// Forms
		'forms.title': 'Forms',
		'forms.new': 'New Form',
		'forms.edit': 'Edit Form',
		'forms.create': 'Create Form',
		'forms.name': 'Form Name',
		'forms.version': 'SurveyJS Version',
		'forms.languages': 'Languages',
		'forms.definition': 'Survey Definition (JSON)',
		'forms.info': 'Form Info',
		'forms.created': 'Created',
		'forms.lastUpdate': 'Last Update',
		'forms.saveChanges': 'Save Changes',
		'forms.createCampaign': 'Create Campaign',
		'forms.viewSnapshots': 'View Snapshots',
		'forms.formatJson': 'Format JSON',
		
		// Campaigns
		'campaigns.title': 'Campaigns',
		'campaigns.new': 'New Campaign',
		'campaigns.create': 'Create Campaign'
	},
	
	cs: {
		// Common
		'app.name': 'Evalytics Dotazníky',
		'common.save': 'Uložit',
		'common.cancel': 'Zrušit',
		'common.delete': 'Smazat',
		'common.edit': 'Upravit',
		'common.create': 'Vytvořit',
		'common.back': 'Zpět',
		'common.loading': 'Načítání...',
		'common.saving': 'Ukládání...',
		'common.search': 'Hledat',
		'common.filter': 'Filtrovat',
		
		// Auth
		'auth.login': 'Přihlásit se',
		'auth.logout': 'Odhlásit se',
		'auth.email': 'Email',
		'auth.password': 'Heslo',
		
		// Forms
		'forms.title': 'Formuláře',
		'forms.new': 'Nový formulář',
		'forms.edit': 'Upravit formulář',
		'forms.create': 'Vytvořit formulář',
		'forms.name': 'Název formuláře',
		'forms.version': 'Verze SurveyJS',
		'forms.languages': 'Jazyky',
		'forms.definition': 'Definice dotazníku (JSON)',
		'forms.info': 'Info o formuláři',
		'forms.created': 'Vytvořeno',
		'forms.lastUpdate': 'Poslední změna',
		'forms.saveChanges': 'Uložit změny',
		'forms.createCampaign': 'Vytvořit kampaň',
		'forms.viewSnapshots': 'Zobrazit snímky',
		'forms.formatJson': 'Formátovat JSON',
		
		// Campaigns
		'campaigns.title': 'Kampaně',
		'campaigns.new': 'Nová kampaň',
		'campaigns.create': 'Vytvořit kampaň'
	},
	
	de: {
		// Common
		'app.name': 'Evalytics Umfragen',
		'common.save': 'Speichern',
		'common.cancel': 'Abbrechen',
		'common.delete': 'Löschen',
		'common.edit': 'Bearbeiten',
		'common.create': 'Erstellen',
		'common.back': 'Zurück',
		'common.loading': 'Laden...',
		'common.saving': 'Speichern...',
		'common.search': 'Suchen',
		'common.filter': 'Filtern',
		
		// Auth
		'auth.login': 'Anmelden',
		'auth.logout': 'Abmelden',
		'auth.email': 'E-Mail',
		'auth.password': 'Passwort',
		
		// Forms
		'forms.title': 'Formulare',
		'forms.new': 'Neues Formular',
		'forms.edit': 'Formular bearbeiten',
		'forms.create': 'Formular erstellen',
		'forms.name': 'Formularname',
		'forms.version': 'SurveyJS Version',
		'forms.languages': 'Sprachen',
		'forms.definition': 'Umfragedefinition (JSON)',
		'forms.info': 'Formular Info',
		'forms.created': 'Erstellt',
		'forms.lastUpdate': 'Letzte Änderung',
		'forms.saveChanges': 'Änderungen speichern',
		'forms.createCampaign': 'Kampagne erstellen',
		'forms.viewSnapshots': 'Snapshots anzeigen',
		'forms.formatJson': 'JSON formatieren'
	}
};

// Derived store for translations
export const translations_store = derived(
	currentLanguage,
	($lang) => {
		return (key) => {
			try {
				return t(key, $lang);
			} catch (error) {
				console.warn(`Translation error for key "${key}":`, error);
				return key;
			}
		};
	}
);
