import { createClient } from '@supabase/supabase-js'

// 1. Ambil "alamat" dan "kunci" dari file .env.local lo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 2. Cek dulu, kalau kuncinya nggak ketemu, kasih tau lewat console biar nggak bingung pas error
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Waduh! URL atau Anon Key Supabase belum di-setting di .env.local, Bro!')
}

// 3. Rakit koneksinya dan ekspor biar bisa dipake di file lain (kayak TableView atau Kanban)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)