const SUPABASE_URL = 'https://emwtfewucybvkdskkrgn.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtd3RmZXd1Y3lidmtkc2trcmduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI2MTAyNCwiZXhwIjoyMDk2ODM3MDI0fQ.8yJIyvf-ZwPmIzUsZo0k4dSenzo1R8p8F1OpBL9yMTM'

const PASSWORD = 'etciso206'

const jurors = [
  { name: 'Lt Gen M U Nair', email: 'munair@etjury.com' },
  { name: 'Kalpesh Doshi',   email: 'kalpesh@etjury.com' },
  { name: 'Dr Ram Kumar G',  email: 'ram@etjury.com' },
  { name: 'Burgese Cooper',  email: 'burgese@etjury.com' },
  { name: 'Vijay Debnath',   email: 'vijay@etjury.com' },
  { name: 'Mr Marshal',      email: 'marshal@etjury.com' },
]

for (const juror of jurors) {
  // 1. Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: juror.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: juror.name, role: 'juror' },
    }),
  })

  const authData = await authRes.json()

  if (!authRes.ok) {
    console.error(`✗ ${juror.name} (auth): ${authData.message || JSON.stringify(authData)}`)
    continue
  }

  const userId = authData.id

  // 2. Upsert jury_users row
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/jury_users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: userId, name: juror.name, email: juror.email, role: 'juror' }),
  })

  if (!dbRes.ok) {
    const dbData = await dbRes.json()
    console.error(`✗ ${juror.name} (db): ${dbData.message || JSON.stringify(dbData)}`)
  } else {
    console.log(`✓ ${juror.name} — ${juror.email}`)
  }
}
