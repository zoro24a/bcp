import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { action, payload } = requestBody;

    console.log(`Edge Function received action: ${action}`);
    // console.log('Payload:', JSON.stringify(payload)); // Keep this commented unless needed for sensitive data

    // Create a Supabase client with the Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    let result;

    switch (action) {
      case 'listUsers':
        result = await supabaseAdmin.auth.admin.listUsers(payload.options);
        break;
      case 'signUp':
        // Ensure payload.credentials contains email, password, and options
        if (!payload.credentials || !payload.credentials.email || !payload.credentials.password) {
             return new Response(JSON.stringify({ error: 'Missing email or password for signup' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        
        // Use auth.admin.createUser for server-side creation without email confirmation flow
        result = await supabaseAdmin.auth.admin.createUser({
            email: payload.credentials.email,
            password: payload.credentials.password,
            user_metadata: payload.credentials.options?.data,
            email_confirm: true, // Ensure user is confirmed immediately
        });
        break;
      case 'updateUserById':
        result = await supabaseAdmin.auth.admin.updateUserById(payload.userId, payload.updates);
        break;
      case 'deleteUser':
        result = await supabaseAdmin.auth.admin.deleteUser(payload.userId);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    if (result.error) {
      console.error('Edge Function Error (Supabase Admin API):', result.error);
      
      // Determine status code based on Supabase error status or default to 400
      const status = result.error.status === 422 ? 400 : (result.error.status || 400);
      
      return new Response(JSON.stringify({ error: result.error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: status,
      });
    }

    return new Response(JSON.stringify(result.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Unexpected Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});