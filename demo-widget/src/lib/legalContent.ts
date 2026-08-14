// Mock admin-authored content for the fictional "Loom & Blade" demo salon —
// this is TenantConfig-equivalent data (tenant-specific, not part of the
// real app's source), authored for the demo the same way a real salon owner
// would author it through the admin settings UI. Written in the real app's
// markdown-lite subset (## / ### headings, "- " bullets, **bold**).

export const salonContact = {
  companyName: 'Loom & Blade Sp. z o.o.',
  nip: '000-000-00-00',
  legalAddress: 'ul. Grzybowska 62/lok. U4, 00-844 Warszawa',
  email: 'hello@loomandblade.pl',
}

export const privacyContent = `We take the protection of your personal data seriously. This policy explains what we collect and how we use it when you book a visit with us.

## Information We Collect

- Contact information: first name, last name, phone number, email address.
- Booking history: details of past and upcoming appointments and selected services.
- Your data is never shared with third parties without your explicit consent.

## How We Use Your Data

We use your contact details to confirm and remind you about your booking, and your booking history to help our specialists prepare for your visit.

## Your Rights

You can request access to, export, or deletion of your data at any time through our Help Center.`

export const termsContent = `By booking a visit with Loom & Blade, you agree to the following terms.

## Booking Rules

- Free cancellation up to 24 hours before your appointment.
- Please provide accurate contact details so we can reach you if needed.
- Pricing may be adjusted if extra requirements are agreed during your visit.

## Changes to These Terms

We may update these terms from time to time. The current version is always available on this page.`
