/**
 * One-time script to create demo user via Supabase Auth Admin API.
 * Run with: node seed-demo-user.mjs
 * Delete after use.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jkmggwdizacanrtosefj.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbWdnd2RpemFjYW5ydG9zZWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3MjUyOSwiZXhwIjoyMDg3ODQ4NTI5fQ.f7CoYJCXJ0RaDZbB1CLhWhMCcw6LZPyL_tCKJ5BtC7o'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    console.log('1. Creating demo auth user...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'demo@krishisakhi.dev',
        password: 'KrishiDemo123!',
        email_confirm: true,
        user_metadata: { full_name: 'Ramesh Kumar' }
    })

    if (authError) {
        console.error('Auth error:', authError.message)
        process.exit(1)
    }

    console.log('   User created with ID:', authData.user.id)

    console.log('2. Inserting farmer row...')
    const { data: farmerData, error: farmerError } = await supabase
        .from('farmers')
        .insert({
            id: authData.user.id,
            full_name: 'Ramesh Kumar',
            preferred_language: 'english',
            state: 'Telangana',
            district: 'Hyderabad',
            onboarding_complete: false,
        })
        .select()

    if (farmerError) {
        console.error('Farmer insert error:', farmerError.message)
        process.exit(1)
    }

    console.log('   Farmer row created:', farmerData[0].full_name)
    console.log('')
    console.log('=== Demo User Ready ===')
    console.log('Email:    demo@krishisakhi.dev')
    console.log('Password: KrishiDemo123!')
    console.log('User ID:', authData.user.id)
    console.log('')
    console.log('Update VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD in frontend/.env if needed.')
}

main()
