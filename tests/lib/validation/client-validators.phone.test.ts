/// <reference types='vitest' />

import { describe, expect, it } from 'vitest'
import { validatePhone } from '../../../src/lib/validation/client-validators'

describe('validatePhone', () => {
  it('accepts a Polish number with +48 and 9 digits', () => {
    const result = validatePhone('+48501748708')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects a Polish number with missing digits after +48', () => {
    const result = validatePhone('+4850174870')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Polski numer powinien mieć 9 cyfr po +48')
  })

  it('rejects empty value', () => {
    const result = validatePhone('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Numer telefonu jest wymagany')
  })
})

