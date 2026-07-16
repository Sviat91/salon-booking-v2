import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendEmail, getSmtpConfig } from '@/lib/email'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }
  
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const smtp = await getSmtpConfig()
    if (!smtp) {
      return NextResponse.json(
        { error: "SMTP is not configured. Fill in SMTP Host, Username and Password in Email Settings and save first.", code: "SMTP_NOT_CONFIGURED" },
        { status: 400 }
      )
    }

    await sendEmail({
      to: email,
      subject: "Test Email from Salon Booking",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>SMTP Test Successful</h2>
          <p>Your SMTP settings have been configured correctly.</p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[email-settings TEST] Failed to send test email:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send email. Check your SMTP settings and credentials." }, 
      { status: 500 }
    )
  }
}
