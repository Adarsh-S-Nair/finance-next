import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// Map category group names to react-icons
// Using Fi (Feather Icons) library for consistency
const CATEGORY_ICONS = {
  'Income':                    { icon_lib: 'Fi', icon_name: 'FiDollarSign' },
  'Transfer In':               { icon_lib: 'Fi', icon_name: 'FiArrowDownLeft' },
  'Transfer Out':              { icon_lib: 'Fi', icon_name: 'FiArrowUpRight' },
  'Food and Drink':            { icon_lib: 'Fi', icon_name: 'FiCoffee' },
  'Entertainment':             { icon_lib: 'Fi', icon_name: 'FiMusic' },
  'Transportation':            { icon_lib: 'Fi', icon_name: 'FiTruck' },
  'Travel':                    { icon_lib: 'Fi', icon_name: 'FiMapPin' },
  'Rent and Utilities':        { icon_lib: 'Fi', icon_name: 'FiHome' },
  'Medical':                   { icon_lib: 'Fi', icon_name: 'FiHeart' },
  'Personal Care':             { icon_lib: 'Fi', icon_name: 'FiSmile' },
  'General Merchandise':       { icon_lib: 'Fi', icon_name: 'FiShoppingBag' },
  'General Services':          { icon_lib: 'Fi', icon_name: 'FiBriefcase' },
  'Government and Non Profit': { icon_lib: 'Fi', icon_name: 'FiFlag' },
  'Home Improvement':          { icon_lib: 'Fi', icon_name: 'FiTool' },
  'Loan Payments':             { icon_lib: 'Fi', icon_name: 'FiCreditCard' },
  'Loan Disbursements':        { icon_lib: 'Fi', icon_name: 'FiDownload' },
  'Bank Fees':                 { icon_lib: 'Fi', icon_name: 'FiAlertCircle' },
  'Other':                     { icon_lib: 'Fi', icon_name: 'FiMoreHorizontal' },
};

(async () => {
  let updated = 0;
  for (const [name, icons] of Object.entries(CATEGORY_ICONS)) {
    const { error, count } = await sb
      .from('category_groups')
      .update(icons)
      .eq('name', name)
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error(`Failed to update "${name}":`, error.message);
    } else {
      console.log(`✅ ${name} → ${icons.icon_lib}/${icons.icon_name}`);
      updated++;
    }
  }
  console.log(`\nUpdated ${updated} category groups`);
})();
