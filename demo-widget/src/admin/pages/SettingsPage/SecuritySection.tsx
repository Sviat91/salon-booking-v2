const fieldClass = 'w-full h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed'

// Structural, inert port of SuperAdminCredentials.tsx — two disabled cards,
// no local state, Save button is disabled-looking and does nothing.
function CredentialCard({ title, fields }: { title: string; fields: { label: string; type: string }[] }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.label} className="grid gap-1.5">
            <span className="text-sm text-muted-foreground">{f.label}</span>
            <input disabled type={f.type} className={fieldClass} />
          </label>
        ))}
        <button
          disabled
          className="mt-2 h-10 w-fit rounded-md bg-muted px-5 text-sm font-medium text-muted-foreground cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  )
}

export default function SecuritySection() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Change your login email or password. Current password is required for both actions.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CredentialCard
          title="Change Password"
          fields={[
            { label: 'Current password', type: 'password' },
            { label: 'New password', type: 'password' },
            { label: 'Confirm new password', type: 'password' },
          ]}
        />
        <CredentialCard
          title="Change Login Email"
          fields={[
            { label: 'Current password', type: 'password' },
            { label: 'New email', type: 'email' },
          ]}
        />
      </div>
    </div>
  )
}
