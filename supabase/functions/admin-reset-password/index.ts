// supabase/functions/admin-reset-password/index.ts
//
// Admin-triggered password reset. Runs server-side with the service-role
// key (the ONLY safe place for that key to ever exist — never in the
// browser bundle, see REMEDIATION_NOTES.md for why).
//
// SECURITY DESIGN: rather than generating a plaintext "default password"
// and emailing it (a real anti-pattern — that password sits in someone's
// inbox indefinitely, readable by anyone with mail access, and most
// compliance frameworks flag it), this immediately invalidates the
// target user's current password by overwriting it with an unguessable
// random value the admin never sees, then sends them a standard Supabase
// recovery email so they set their own new password. Net effect for the
// admin is identical to what was asked for ("reset their password, they
// get an email") without ever putting a real password in an email body.
//
// Deploy: supabase functions deploy admin-reset-password
// Required secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-injected by
//   Supabase's runtime — no manual secret-setting needed for these two),
//   SITE_URL (your deployed app's URL, e.g. https://talendro.vercel.app)
//   for the recovery email's redirect link.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl = Deno.env.get('SITE_URL') ?? ''

    // Verify the CALLER (using their own JWT, anon-key client) is an
    // approved admin before doing anything privileged. This is the
    // authorization check the previous client-side `auth.admin.*` call
    // could never actually perform — that's exactly why it had to move
    // server-side in the first place.
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role, status')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin' || callerProfile?.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: corsHeaders })
    }

    const { targetUserId } = await req.json()
    if (!targetUserId || typeof targetUserId !== 'string') {
      return new Response(JSON.stringify({ error: 'targetUserId is required' }), { status: 400, headers: corsHeaders })
    }

    // Service-role client — privileged, never exposed to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', targetUserId)
      .single()
    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), { status: 404, headers: corsHeaders })
    }

    // Invalidate the current password with an unguessable random value
    // nobody — including this function — ever logs or returns.
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()
    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password: randomPassword })
    if (updateError) {
      return new Response(JSON.stringify({ error: `Could not reset password: ${updateError.message}` }), { status: 500, headers: corsHeaders })
    }

    // Send the standard recovery email via Supabase Auth's configured
    // SMTP so the user can set their own new password.
    const { error: linkError } = await adminClient.auth.resetPasswordForEmail(targetProfile.email, {
      redirectTo: siteUrl ? `${siteUrl}/reset-password` : undefined,
    })
    if (linkError) {
      return new Response(JSON.stringify({ error: `Password was reset but the email could not be sent: ${linkError.message}` }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, email: targetProfile.email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: corsHeaders })
  }
})
