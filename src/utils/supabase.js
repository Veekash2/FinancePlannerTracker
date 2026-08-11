import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ocgnnyojbjrammxpogkk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ25ueW9qYmpyYW1teHBvZ2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjQyNDksImV4cCI6MjEwMTUwMDI0OX0.W3nd4Ts6911ZjbdFtaqr4655aX51zWshcHz9XrsI6Ao'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
