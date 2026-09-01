jest.mock('../../services/supabase', () => ({ from: jest.fn() }))

const { mockTable } = require('../helpers/supabaseMock')
const supabase = require('../../services/supabase')
const {
  inferType, signedChange, recordMovement, recordQuantityChange, MOVEMENT_TYPES,
} = require('../../services/movements')

beforeEach(() => {
  jest.clearAllMocks()
  supabase.from.mockImplementation(mockTable({ data: { id: 'mv-1' }, error: null }))
})

const ITEM = { id: 'i1', name: 'Widget', sku: 'W-1' }

describe('signedChange', () => {
  it('makes inbound types positive', () => {
    expect(signedChange('received', 5)).toBe(5)
    expect(signedChange('returned', 5)).toBe(5)
  })

  it('makes outbound types negative', () => {
    expect(signedChange('sold', 5)).toBe(-5)
    expect(signedChange('damaged', 5)).toBe(-5)
    expect(signedChange('adjusted', 5)).toBe(-5)
  })

  it('ignores the sign the caller passed', () => {
    // A caller must not be able to record a sale as an increase
    expect(signedChange('sold', -5)).toBe(-5)
    expect(signedChange('received', -5)).toBe(5)
  })

  it('treats non-numeric input as zero', () => {
    expect(signedChange('received', 'abc')).toBe(0)
  })
})

describe('inferType', () => {
  it('reads an increase as stock received', () => {
    expect(inferType(10)).toBe('received')
  })

  it('reads a decrease as an adjustment rather than a sale', () => {
    // Claiming a sale that may not have happened would corrupt revenue
    expect(inferType(-10)).toBe('adjusted')
  })
})

describe('recordMovement', () => {
  it('writes a movement row', async () => {
    const res = await recordMovement({
      organizationId: 'org-1', item: ITEM, movementType: 'received',
      quantityChange: 5, quantityBefore: 0, quantityAfter: 5,
    })
    expect(res).toEqual({ id: 'mv-1' })
    expect(supabase.from).toHaveBeenCalledWith('techit_stock_movements')
  })

  it('skips a no-op change', async () => {
    const res = await recordMovement({
      organizationId: 'org-1', item: ITEM, movementType: 'adjusted',
      quantityChange: 0, quantityBefore: 5, quantityAfter: 5,
    })
    expect(res).toBeNull()
  })

  it('returns null rather than throwing on an unknown type', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await recordMovement({
      organizationId: 'org-1', item: ITEM, movementType: 'teleported',
      quantityChange: 1, quantityBefore: 0, quantityAfter: 1,
    })
    expect(res).toBeNull()
    spy.mockRestore()
  })

  it('swallows a database failure so the stock change is not undone', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    supabase.from.mockImplementation(mockTable({ data: null, error: { message: 'db down' } }))

    const res = await recordMovement({
      organizationId: 'org-1', item: ITEM, movementType: 'received',
      quantityChange: 5, quantityBefore: 0, quantityAfter: 5,
    })

    expect(res).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('recordQuantityChange', () => {
  it('does nothing when the quantity did not move', async () => {
    const res = await recordQuantityChange({
      organizationId: 'org-1', item: ITEM, quantityBefore: 5, quantityAfter: 5,
    })
    expect(res).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('infers the type from the direction of the change', async () => {
    await recordQuantityChange({
      organizationId: 'org-1', item: ITEM, quantityBefore: 0, quantityAfter: 8,
    })
    expect(supabase.from).toHaveBeenCalledWith('techit_stock_movements')
  })

  it('honours an explicit type over the inferred one', async () => {
    const res = await recordQuantityChange({
      organizationId: 'org-1', item: ITEM,
      quantityBefore: 10, quantityAfter: 4, movementType: 'sold',
    })
    expect(res).toEqual({ id: 'mv-1' })
  })
})

describe('MOVEMENT_TYPES', () => {
  it('matches the set the database constraint allows', () => {
    expect(MOVEMENT_TYPES).toEqual(['received', 'sold', 'damaged', 'returned', 'adjusted'])
  })
})
