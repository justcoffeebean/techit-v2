const { createClient } = require('@supabase/supabase-js')

if (!process.env.SUPABASE_URL) {
  throw new Error('Missing required environment variable: SUPABASE_URL')
}

if (!process.env.SUPABASE_KEY) {
  throw new Error('Missing required environment variable: SUPABASE_KEY')
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

module.exports = supabase