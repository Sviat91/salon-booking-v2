import { Card } from './ui/card'

// Real component fetches /api/discounts/today and renders each qualifying
// discount as a plain line inside one card. These two lines are the same
// static promo copy the demo has used throughout.
const DEMO_LINES = ['Wed, Thu 11:00–15:00: -20% on all services', '-10% on all services']

export default function TodayPromoCard() {
  return (
    <Card className="!px-2 !py-3 sm:!px-4 sm:!py-4">
      <div className="space-y-1.5">
        {DEMO_LINES.map((line) => (
          <p key={line} className="text-sm font-medium text-foreground">
            🏷️ {line}
          </p>
        ))}
      </div>
    </Card>
  )
}
