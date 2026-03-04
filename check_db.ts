import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfvzefjxhuqytwchwalo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdnplZmp4aHVxeXR3Y2h3YWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTc0NDIsImV4cCI6MjA3MTQzMzQ0Mn0.n7SLEuA2k4STfSPRxSSD-0-SMREtl25wpm0L9ftPeBo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log("Inspecting 'requests' table columns...");
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching requests:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Found row. Columns present:");
        console.log(Object.keys(data[0]).sort());
    } else {
        // If table is empty, we can try to get column names through a different way or insert a dummy
        console.log("Table is empty. No rows to inspect columns.");
    }
}

check();
