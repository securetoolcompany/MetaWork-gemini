const fs = require('fs');

/**
 * Extracts and filters WooCommerce product categories from the provided JSON.
 * Rules:
 * 1. Exclude categories that are also usernames (logins, nicenames, or display names).
 * 2. Exclude categories that contain "MFG" (case-insensitive).
 */
function extractFilteredCategories(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        // 1. Collect all user-related identifiers to filter out personal "Aisles"
        const userIdentifiers = new Set();
        (data.users || []).forEach(user => {
            if (user.login) userIdentifiers.add(user.login.toLowerCase());
            if (user.nicename) userIdentifiers.add(user.nicename.toLowerCase());
            if (user.display_name) userIdentifiers.add(user.display_name.toLowerCase());
        });

        // 2. Filter categories
        const productCategories = data.product_categories || [];
        const filteredList = productCategories
            .filter(cat => {
                const name = (cat.name || '').trim();
                const slug = (cat.slug || '').trim();

                // Rule: Exclude if name contains "MFG"
                if (name.toUpperCase().includes('MFG')) return false;

                // Rule: Exclude if name or slug matches a known username
                if (userIdentifiers.has(name.toLowerCase()) || userIdentifiers.has(slug.toLowerCase())) {
                    return false;
                }

                // Rule: Exclude generic system categories if necessary (optional)
                if (name.toLowerCase() === 'uncategorized') return false;

                return true;
            })
            .map(cat => cat.name);

        // Remove duplicates and sort alphabetically
        const uniqueSortedList = [...new Set(filteredList)].sort((a, b) => a.localeCompare(b));

        console.log('--- Filtered WooCommerce Categories ---');
        uniqueSortedList.forEach(name => console.log(name));
        console.log(`\nTotal categories found: ${uniqueSortedList.length}`);

    } catch (error) {
        console.error('Error processing the file:', error.message);
    }
}

// Usage: Provide the correct path to your JSON file
extractFilteredCategories('metawork_complete_export_2026-01-25_21-20-36.json');