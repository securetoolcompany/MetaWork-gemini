import countries from 'i18n-iso-countries';
// Changed 'assert' to 'with'
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';

// Register the languages you need
countries.registerLocale(enLocale);

// Get the full list of countries (Alpha-2 codes as keys)
const countryData = countries.getNames("en", { select: "official" });

// Format them for your data/countries.json
const formatted = Object.entries(countryData).map(([code, name]) => ({
  name: name,
  code: code.toUpperCase()
}));

// Ensure the data directory exists
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Write the file
fs.writeFileSync(path.join(dataDir, 'countries.json'), JSON.stringify(formatted, null, 2));

console.log("✅ Successfully populated /data/countries.json");