import { exec } from 'kernelsu-alt';

const rtlLang = [
    'ar',  // Arabic
    'fa',  // Persian
    'he',  // Hebrew
    'ur',  // Urdu
    'ps',  // Pashto
    'sd',  // Sindhi
    'ku',  // Kurdish
    'yi',  // Yiddish
    'dv',  // Dhivehi
];

let translations = {};
let baseTranslations = {};
let availableLanguages = ['en'];
let languageNames = {};

/**
 * Get a formatted string based on the language key and optional arguments
 * Supported formats: %s, %d, %f, %x, %1$s, %2$d, etc.
 * @param {string} id - The translation key
 * @param {...any} args - Arguments to format into the string
 * @returns {string} - The formatted translation
 */
export function getString(id, ...args) {
    let translation = translations[id] || (baseTranslations && baseTranslations[id]) || id;
    if (args.length === 0) return translation;

    let argIndex = 0;
    return translation.replace(/%(?:(\d+)\$)?([%sdfx])/g, (match, index, type) => {
        if (type === '%') return '%';
        if (index) {
            const i = parseInt(index) - 1;
            return args[i] !== undefined ? args[i] : match;
        } else {
            return args[argIndex++] !== undefined ? args[argIndex - 1] : match;
        }
    });
}

/**
 * Parse XML translation file into a JavaScript object
 * @param {string} xmlText - The XML content as string
 * @returns {Object} - Parsed translations
 */
function parseTranslationsXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid translation XML: ' + parseError.textContent);
    }

    const strings = xmlDoc.getElementsByTagName('string');
    const result = {};

    for (let i = 0; i < strings.length; i++) {
        const string = strings[i];
        const name = string.getAttribute('name');
        if (!name) continue;
        const value = string.textContent.replace(/\\n/g, '\n');
        result[name] = value;
    }

    return result;
}

/**
 * Case-insensitive lookup of a language code in the available list.
 * Returns the canonical code from languages.json, or null.
 */
function findAvailableLanguage(code) {
    if (!code) return null;
    const lower = code.toLowerCase();
    return availableLanguages.find(l => l.toLowerCase() === lower) || null;
}

/**
 * Detect user's default language
 */
async function detectUserLanguage() {
    const userLang = navigator.language || navigator.userLanguage || '';
    const langCode = userLang.split('-')[0];

    try {
        const availableResponse = await fetch('locales/languages.json');
        const availableData = await availableResponse.json();
        availableLanguages = Object.keys(availableData);
        languageNames = availableData;

        const preferredLanguageCode = localStorage.getItem('kp-next_language');

        if (preferredLanguageCode && preferredLanguageCode !== 'default') {
            const matched = findAvailableLanguage(preferredLanguageCode);
            if (matched) return matched;
        }

        const byUserLang = findAvailableLanguage(userLang);
        if (byUserLang) return byUserLang;

        const byLangCode = findAvailableLanguage(langCode);
        if (byLangCode) return byLangCode;

        localStorage.removeItem('kp-next_language');
        return 'en';
    } catch (error) {
        console.error('Error detecting user language:', error);
        return 'en';
    }
}

/**
 * Load translations dynamically based on the selected language
 */
export async function loadTranslations() {
    try {
        const baseResponse = await fetch('./locales/strings/en.xml');
        const baseXML = await baseResponse.text();
        baseTranslations = parseTranslationsXML(baseXML);

        const lang = await detectUserLanguage();
        if (lang !== 'en') {
            const response = await fetch(`locales/strings/${lang}.xml`);
            const userXML = await response.text();
            const userTranslations = parseTranslationsXML(userXML);
            translations = { ...baseTranslations, ...userTranslations };
        } else {
            translations = baseTranslations;
        }

        const isRTL = rtlLang.includes(lang.split('-')[0].toLowerCase());
        const dir = isRTL ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('dir', dir);
        document.querySelectorAll('[flip-icon-in-rtl="true"]').forEach(el => {
            el.style.transform = dir === 'rtl' ? 'scaleX(-1)' : 'scaleX(1)';
        });

        await generateLanguageMenu();
    } catch (error) {
        console.error('Error loading translations:', error);
        translations = baseTranslations;
    }
    applyTranslations();
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const translation = getString(key);
        if (translation !== key) {
            if (el.hasAttribute("placeholder")) {
                el.setAttribute("placeholder", translation);
            } else if (el.hasAttribute("label")) {
                el.setAttribute("label", translation);
            } else {
                el.textContent = translation;
            }
        }
    });
}

/**
 * Set language: persist to localStorage AND to /data/adb/kp-next/language
 * (the latter is read by status.sh / service.sh for module card text)
 */
function setLanguage(language) {
    localStorage.setItem('kp-next_language', language);

    const persistDir = '/data/adb/kp-next';
    const cmd = (language === 'default')
        ? `rm -f "${persistDir}/language"`
        : `mkdir -p "${persistDir}" && echo "${language}" > "${persistDir}/language"`;

    exec(cmd).finally(() => window.location.reload());
}

/**
 * Generate the language menu dynamically
 */
async function generateLanguageMenu() {
    const languageForm = document.getElementById('language-form');
    languageForm.innerHTML = '';

    const createOption = (lang, name) => {
        const label = document.createElement('label');
        label.className = 'language-option';
        label.innerHTML = `
            <md-radio name="language" value="${lang}"></md-radio>
            <span>${name}</span>
        `;

        const radio = label.querySelector('md-radio');

        const storedLang = localStorage.getItem('kp-next_language');
        const isSelected = storedLang === null
            ? lang === 'default'
            : storedLang === lang;

        if (isSelected) {
            radio.checked = true;
            const currentLabel = document.getElementById('current-language');
            if (currentLabel) currentLabel.textContent = name;
        }

        radio.addEventListener('change', () => {
            if (radio.checked) setLanguage(lang);
        });

        languageForm.appendChild(label);
    };

    createOption('default', getString('label_system_default'));

    const sortedLanguages = Object.entries(languageNames)
        .map(([lang, name]) => ({ lang, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    sortedLanguages.forEach(({ lang, name }) => {
        createOption(lang, name);
    });

    applyTranslations();
}