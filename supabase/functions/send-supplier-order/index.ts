import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigin = 'https://leefesel-debug.github.io'
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const origin = request.headers.get('origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ error: 'Order email service is not configured' }, 503)

  const authorization = request.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'Sign in is required' }, 401)

  let payload: { order_id?: string; test_mode?: boolean } = {}
  try { payload = await request.json() } catch { return json({ error: 'Invalid request' }, 400) }
  const orderId = String(payload.order_id || '')
  const testMode = payload.test_mode === true
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid order' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: pendingOrder, error: orderError } = await admin.from('purchase_orders').select('id,supplier_id,supplier_name,supplier_email,supplier_cc_email,delivery_date,created_by,status,active').eq('id', orderId).maybeSingle()
  if (orderError) return json({ error: 'The order could not be loaded' }, 500)
  if (!pendingOrder || !pendingOrder.active || pendingOrder.status !== 'prepared') return json({ error: 'This order has already been sent, cancelled or is currently being processed' }, 409)

  const { data: adminAccess } = await userClient.rpc('is_admin')
  if (pendingOrder.created_by !== user.id && adminAccess !== true) return json({ error: 'Only the person who prepared this order or an administrator can send it' }, 403)
  if (testMode && adminAccess !== true) return json({ error: 'Test mode is restricted to administrators' }, 403)

  const { data: order, error: claimError } = await admin.from('purchase_orders').update({ status: 'sending', updated_by: user.id, last_send_error: null }).eq('id', orderId).eq('status', 'prepared').eq('active', true).select('id,supplier_id,supplier_name,supplier_email,supplier_cc_email,delivery_date,status').maybeSingle()
  if (claimError) return json({ error: 'The order could not be prepared for sending' }, 500)
  if (!order) return json({ error: 'This order has already been sent, cancelled or is currently being processed' }, 409)

  const allowedRecipients: Record<string, { to: string; cc: string[]; greeting: string }> = {
    'Aubrey Allen': { to: 'sales@aubreyallen.co.uk', cc: ['hello@woodscoffeeshop.co.uk'], greeting: 'team' },
    'John Dwyer Bakery': { to: 'orders@johndwyerbakery.co.uk', cc: ['sales@johndwyerbakery.co.uk', 'hello@woodscoffeeshop.co.uk'], greeting: 'team' },
    'Monsoon Estates': { to: 'trade@monsoonestates.co.uk', cc: ['hello@woodscoffeeshop.co.uk'], greeting: 'Anne' },
  }
  const allowed = allowedRecipients[order.supplier_name]
  const suppliedCc = String(order.supplier_cc_email || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean).sort()
  const expectedCc = allowed ? [...allowed.cc].sort() : []
  if (!allowed || allowed.to !== String(order.supplier_email).toLowerCase() || JSON.stringify(expectedCc) !== JSON.stringify(suppliedCc)) {
    await admin.from('purchase_orders').update({ status: 'prepared', updated_by: user.id, last_send_error: 'Supplier recipient validation failed' }).eq('id', orderId)
    return json({ error: 'Supplier recipient validation failed' }, 403)
  }

  const { data: supplier } = await admin.from('order_suppliers').select('id').eq('id', order.supplier_id).eq('name', order.supplier_name).eq('email', order.supplier_email).eq('active', true).maybeSingle()
  if (!supplier) { await admin.from('purchase_orders').update({ status: 'prepared', updated_by: user.id, last_send_error: 'Supplier validation failed' }).eq('id', orderId); return json({ error: 'Supplier validation failed' }, 403) }

  const { data: lines, error: linesError } = await admin.from('purchase_order_lines').select('supplier_item_id,quantity').eq('order_id', orderId).order('id')
  const itemIds = [...new Set((lines || []).map((line) => line.supplier_item_id).filter(Boolean))]
  const { data: catalogue, error: catalogueError } = itemIds.length ? await admin.from('order_items').select('id,supplier_id,singular_phrase,plural_phrase,active').in('id', itemIds) : { data: [], error: null }
  const items = new Map((catalogue || []).map((item) => [item.id, item]))
  const validLines = (lines || []).every((line) => { const item = items.get(line.supplier_item_id); return item && item.active && item.supplier_id === order.supplier_id && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99 })
  if (linesError || catalogueError || !lines?.length || !validLines) { await admin.from('purchase_orders').update({ status: 'prepared', updated_by: user.id, last_send_error: 'Order item validation failed' }).eq('id', orderId); return json({ error: 'Order item validation failed' }, 400) }

  const orderLines = lines.map((line) => { const item = items.get(line.supplier_item_id)!; return `- ${line.quantity} ${line.quantity === 1 ? item.singular_phrase : item.plural_phrase}` }).join('\n')
  const deliveryDate = new Date(`${String(order.delivery_date)}T12:00:00Z`)
  const deliveryLabel = Number.isNaN(deliveryDate.getTime()) ? 'on the requested date' : `on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(deliveryDate)}`
  const subject = `${testMode ? '[TEST] ' : ''}Woods Coffee Shop`
  const body = `${testMode ? `TEST MODE — this email was NOT sent to ${order.supplier_name}.\n\n` : ''}Hi ${allowed.greeting},\n\nPlease could I order the following for delivery ${deliveryLabel}:\n\n${orderLines}\n\nThanks,\nWoods`
  const to = testMode ? ['hello@woodscoffeeshop.co.uk'] : [order.supplier_email]
  const cc = testMode ? [] : allowed.cc

  let emailResponse: Response
  try {
    emailResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `woods-order-${order.id}${testMode ? '-test' : ''}` }, body: JSON.stringify({ from: 'Woods Coffee Shop <hello@woodscoffeeshop.co.uk>', reply_to: 'hello@woodscoffeeshop.co.uk', to, ...(cc.length ? { cc } : {}), subject, text: body, tags: [{ name: 'order_id', value: order.id }, { name: 'mode', value: testMode ? 'test' : 'live' }] })
  } catch { await admin.from('purchase_orders').update({ status: 'prepared', updated_by: user.id, last_send_error: 'Email provider could not be reached' }).eq('id', orderId); return json({ error: 'Email provider could not be reached' }, 502) }

  const providerData = await emailResponse.json().catch(() => ({}))
  if (!emailResponse.ok) { const detail = String(providerData.message || providerData.error || `Email provider returned ${emailResponse.status}`).slice(0, 500); await admin.from('purchase_orders').update({ status: 'prepared', updated_by: user.id, last_send_error: detail }).eq('id', orderId); return json({ error: detail }, 502) }

  const { error: updateError } = await admin.from('purchase_orders').update({ status: 'sent', sent_at: new Date().toISOString(), updated_by: user.id, email_subject: subject, email_body: body, provider_message_id: providerData.id || null, last_send_error: null }).eq('id', orderId).eq('status', 'sending')
  if (updateError) return json({ error: 'Email was accepted, but the order history could not be updated. Please tell an administrator.' }, 500)
  return json({ sent: true, order_id: orderId, test_mode: testMode, delivered_to: to })
})
