#!/usr/bin/env node

/**
 * Plaid Personal Finance Categories Sync Script
 * 
 * This script fetches the latest PFC taxonomy from Plaid's CSV and updates
 * the database with any new categories. Run manually or via cron to keep
 * categories up-to-date as Plaid releases new versions.
 * 
 * Usage:
 *   node scripts/syncPlaidCategories.js
 *   
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --verbose    Show detailed output
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

// Configuration
const PLAID_CSV_URL = 'https://plaid.com/documents/pfc-taxonomy-all.csv';
const PLAID_ICON_BASE_URL = 'https://plaid-category-icons.plaid.com';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Convert Plaid key to display name
 * e.g., "RENT_AND_UTILITIES" -> "Rent and Utilities"
 */
function formatCategoryName(key) {
    if (!key) return '';

    const words = key.toLowerCase().split('_');
    const lowercaseWords = new Set(['and', 'or', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'the', 'a', 'an']);

    return words.map((word, index) => {
        // Always capitalize first word, otherwise check if it's a lowercase word
        if (index === 0 || !lowercaseWords.has(word)) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    }).join(' ');
}

/**
 * Extract the detailed label from a full Plaid key
 * e.g., "RENT_AND_UTILITIES_RENT" with primary "RENT_AND_UTILITIES" -> "Rent"
 */
function extractDetailedLabel(detailedKey, primaryKey) {
    if (!detailedKey || !primaryKey) return '';

    if (detailedKey.startsWith(primaryKey + '_')) {
        const suffix = detailedKey.substring(primaryKey.length + 1);
        return formatCategoryName(suffix);
    }

    return formatCategoryName(detailedKey);
}

/**
 * Muted color palette for category groups (18 distinct tones).
 */
const GROUP_PALETTE = [
    '#8ba3bf', '#b0a090', '#7a9e8e', '#b09aaf', '#9ab3b3',
    '#c4a882', '#8e8faa', '#a3b5a0', '#b5929a', '#8caab5',
    '#a89a82', '#91a8a0', '#b8a3b3', '#9db09a', '#a8949e',
    '#85a6a6', '#bca88e', '#9c97b0', '#a0b392', '#b39a8e',
];

/**
 * Generate a unique muted hex color for a category group.
 */
function generateGroupColor(existingColors, index) {
    const color = GROUP_PALETTE[index % GROUP_PALETTE.length];
    if (existingColors.includes(color)) {
        return generateMutedColor(index * 17); // deterministic fallback
    }
    return color;
}

/**
 * Generate a unique muted hex color for a system category.
 * Uses HSL with low saturation spread evenly across the hue wheel.
 */
function generateMutedColor(index) {
    // Golden angle spacing for maximum hue separation
    const hue = (index * 137.508) % 360;
    const saturation = 18 + (index % 3) * 5;  // 18-28%
    const lightness = 58 + (index % 5) * 4;   // 58-74%

    // HSL to hex
    const s = saturation / 100;
    const l = lightness / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + hue / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

async function fetchPlaidTaxonomy() {
    console.log('📥 Fetching Plaid PFC taxonomy...');

    const response = await fetch(PLAID_CSV_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch taxonomy: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    console.log(`📊 Parsed ${records.length} records from CSV`);
    return records;
}

async function getExistingCategories() {
    const { data: groups, error: groupsError } = await supabase
        .from('category_groups')
        .select('id, name, plaid_category_key, hex_color');

    if (groupsError) throw groupsError;

    const { data: categories, error: categoriesError } = await supabase
        .from('system_categories')
        .select('id, label, plaid_category_key, group_id, hex_color');

    if (categoriesError) throw categoriesError;

    return { groups, categories };
}

async function syncCategories() {
    try {
        // Fetch taxonomy and existing data
        const records = await fetchPlaidTaxonomy();
        const { groups, categories } = await getExistingCategories();

        // Build lookup maps
        const existingGroupKeys = new Set(groups.map(g => g.plaid_category_key).filter(Boolean));
        const existingCategoryKeys = new Set(categories.map(c => c.plaid_category_key).filter(Boolean));
        const existingColors = groups.map(g => g.hex_color).filter(Boolean);

        // Group key -> group id mapping
        const groupKeyToId = new Map();
        groups.forEach(g => {
            if (g.plaid_category_key) groupKeyToId.set(g.plaid_category_key, g.id);
        });

        // Extract unique primary and detailed categories from CSV
        const primaryCategories = new Map(); // key -> display name
        const detailedCategories = new Map(); // key -> { displayName, primaryKey }

        for (const record of records) {
            // Skip header/note rows
            if (!record['PFCv2 Primary'] || record['PFCv2 Primary'].startsWith('Note:')) continue;

            const primaryKey = record['PFCv2 Primary'];
            const detailedKey = record['PFCv2 Detailed'];

            if (primaryKey && !primaryCategories.has(primaryKey)) {
                primaryCategories.set(primaryKey, formatCategoryName(primaryKey));
            }

            if (detailedKey && !detailedCategories.has(detailedKey)) {
                detailedCategories.set(detailedKey, {
                    displayName: extractDetailedLabel(detailedKey, primaryKey),
                    primaryKey: primaryKey,
                });
            }
        }

        console.log(`\n📋 Found ${primaryCategories.size} primary categories and ${detailedCategories.size} detailed categories in Plaid taxonomy`);

        // Find new primary categories to add
        const newGroups = [];
        let colorIndex = existingColors.length;

        for (const [key, displayName] of primaryCategories) {
            if (!existingGroupKeys.has(key)) {
                newGroups.push({
                    name: displayName,
                    plaid_category_key: key,
                    icon_url: `${PLAID_ICON_BASE_URL}/PFC_${key}.png`,
                    hex_color: generateGroupColor(existingColors, colorIndex++),
                });
            }
        }

        // Find new detailed categories to add
        const newCategories = [];

        for (const [key, { displayName, primaryKey }] of detailedCategories) {
            if (!existingCategoryKeys.has(key)) {
                // Need the group_id - check if it exists or will be created
                let groupId = groupKeyToId.get(primaryKey);

                if (!groupId) {
                    // Group will be created - we'll need to fetch the ID after insert
                    // For now, mark as pending
                }

                newCategories.push({
                    label: displayName,
                    plaid_category_key: key,
                    primaryKey: primaryKey, // Temporary, will be resolved to group_id
                });
            }
        }

        console.log(`\n🆕 Categories to add:`);
        console.log(`   - ${newGroups.length} new primary categories (category_groups)`);
        console.log(`   - ${newCategories.length} new detailed categories (system_categories)`);

        if (VERBOSE) {
            if (newGroups.length > 0) {
                console.log('\n   New groups:');
                newGroups.forEach(g => console.log(`     • ${g.name} (${g.plaid_category_key})`));
            }
            if (newCategories.length > 0) {
                console.log('\n   New categories:');
                newCategories.slice(0, 10).forEach(c => console.log(`     • ${c.label} (${c.plaid_category_key})`));
                if (newCategories.length > 10) {
                    console.log(`     ... and ${newCategories.length - 10} more`);
                }
            }
        }

        if (DRY_RUN) {
            console.log('\n🔍 Dry run mode - no changes applied');
            return { newGroups: newGroups.length, newCategories: newCategories.length };
        }

        // Insert new groups first
        if (newGroups.length > 0) {
            const { error: insertGroupsError } = await supabase
                .from('category_groups')
                .upsert(newGroups, { onConflict: 'plaid_category_key' });

            if (insertGroupsError) {
                console.error('❌ Error inserting groups:', insertGroupsError);
                throw insertGroupsError;
            }

            console.log(`✅ Inserted ${newGroups.length} new category groups`);
        }

        // Refresh group mapping after inserts
        const { data: updatedGroups } = await supabase
            .from('category_groups')
            .select('id, plaid_category_key');

        const updatedGroupKeyToId = new Map();
        updatedGroups.forEach(g => {
            if (g.plaid_category_key) updatedGroupKeyToId.set(g.plaid_category_key, g.id);
        });

        // Resolve group_ids and assign unique colors for new categories
        // Offset the color index by existing category count for uniqueness
        const existingCategoryCount = categories.length;
        const categoriesToInsert = newCategories.map((c, i) => ({
            label: c.label,
            plaid_category_key: c.plaid_category_key,
            group_id: updatedGroupKeyToId.get(c.primaryKey) || null,
            hex_color: generateMutedColor(existingCategoryCount + i),
        }));

        // Insert new categories
        if (categoriesToInsert.length > 0) {
            const { error: insertCategoriesError } = await supabase
                .from('system_categories')
                .upsert(categoriesToInsert, { onConflict: 'plaid_category_key' });

            if (insertCategoriesError) {
                console.error('❌ Error inserting categories:', insertCategoriesError);
                throw insertCategoriesError;
            }

            console.log(`✅ Inserted ${categoriesToInsert.length} new system categories`);
        }

        console.log('\n🎉 Sync complete!');
        return { newGroups: newGroups.length, newCategories: categoriesToInsert.length };

    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        throw error;
    }
}

// Run the sync
syncCategories()
    .then(result => {
        console.log(`\n📊 Summary: Added ${result.newGroups} groups, ${result.newCategories} categories`);
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
