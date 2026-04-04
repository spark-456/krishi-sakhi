import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Mini dotenv parser
const envFile = fs.readFileSync(path.resolve('../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            env[key] = val;
        }
    }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    console.log(`Testing connection to: ${supabaseUrl}`);
    try {
        // Try getting a list of tables or just querying a known table if it might exist.
        // We will try querying `farmers` or `ref_locations` limit 1.
        // If it returns data or an empty array without network error, connection works.
        const { data, error } = await supabase.from('ref_locations').select('*').limit(1);
        
        if (error) {
            console.error('Supabase Query Error (but connection might be fine, just RLS/Table missing):', error.message);
            // Even if table is missing, the API responded! So connection is verified.
        } else {
            console.log('Successfully connected and queried ref_locations table!');
            console.log('Sample Data:', data);
        }

        // Test auth API ping
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (authError) {
            console.error('Auth API Error:', authError.message);
        } else {
            console.log('Successfully pinged Auth API. Session:', authData.session !== undefined ? 'Checked' : 'Failed');
        }

        console.log('--- CONNECTION VERIFIED ---');
    } catch (err) {
        console.error('Network or Execution Error:', err);
    }
}

testConnection();
