import type { Master } from './types'

export const masters: Master[] = [
  {
    id: 'marek',
    name: 'Marek Zawadzki',
    title: 'Top Barber',
    avatarInitial: 'M',
    profileDisplay: 'bio',
    bio: 'Over 12 years behind the chair, specializing in precision fades and classic wet shaves. Trained in Warsaw and London.',
    achievements: [
      '🏆 Best Barber — Warsaw Grooming Awards 2024',
      '🏢 Resident barber at Loom & Blade since 2019',
      '✂️ Certified straight-razor shave specialist',
    ],
    services: [
      { id: 'm1', name: 'Combo: Haircut & Beard', durationMin: 75, price: 153 },
      { id: 'm2', name: "Classic Men's Haircut", durationMin: 45, price: 99 },
      { id: 'm3', name: 'Royal Shave with Hot Towel', durationMin: 45, price: 90 },
      { id: 'm4', name: 'Hair Wash & Blow Dry Styling', durationMin: 45, price: 81 },
      { id: 'm5', name: 'Deep Nourishing Hair SPA Treatment', durationMin: 60, price: 136 },
      { id: 'm6', name: 'Premium Haircut & Style Consultation', durationMin: 60, price: 162 },
      { id: 'm7', name: 'Beard Trim & Shape', durationMin: 30, price: 72 },
    ],
  },
  {
    id: 'anna',
    name: 'Anna Nowak',
    title: 'Senior Stylist / Color Expert',
    avatarInitial: 'A',
    profileDisplay: 'reviews',
    bio: 'Colorist and stylist with a decade of experience in balayage and precision cutting. Continuously trained on the latest European color techniques.',
    achievements: [
      '🏆 Featured Colorist — Polish Hair Awards 2023',
      '🏢 Senior Stylist at Loom & Blade since 2020',
      '✂️ Certified AirTouch & Balayage specialist',
    ],
    services: [
      { id: 'a1', name: 'Balayage / AirTouch Coloring', durationMin: 210, price: 495 },
      { id: 'a2', name: 'Single-Process Color & Care', durationMin: 120, price: 288 },
      { id: 'a3', name: 'Hair Wash & Blow Dry Styling', durationMin: 45, price: 81 },
      { id: 'a4', name: 'Deep Nourishing Hair SPA Treatment', durationMin: 60, price: 136 },
      { id: 'a5', name: 'Premium Haircut & Style Consultation', durationMin: 60, price: 144 },
      { id: 'a6', name: "Women's Haircut & Styling", durationMin: 60, price: 162 },
    ],
  },
]

export const mockSlotTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']
