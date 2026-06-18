jest.mock('../../services/supabase', () => {
  const insertMock = jest.fn().mockResolvedValue({ data: null, error: null })
  return {
    from: jest.fn().mockReturnValue({ insert: insertMock }),
    __insertMock: insertMock,
  }
})

const supabase = require('../../services/supabase')
const { logAction } = require('../../services/audit')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('logAction', () => {
  it('inserts an audit log entry with all fields', async () => {
    await logAction('user-1', 'admin', 'ADD_ITEM', 'item-1', 'Widget', { quantity: 5 })

    expect(supabase.from).toHaveBeenCalledWith('techit_audit_log')
    expect(supabase.__insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      username: 'admin',
      action: 'ADD_ITEM',
      item_id: 'item-1',
      item_name: 'Widget',
      changes: { quantity: 5 },
    })
  })

  it('inserts null for optional fields when not provided', async () => {
    await logAction('user-1', 'admin', 'DELETE_ITEM', null, null, null)

    expect(supabase.__insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      username: 'admin',
      action: 'DELETE_ITEM',
      item_id: null,
      item_name: null,
      changes: null,
    })
  })

  it('does not throw when supabase insert fails', async () => {
    supabase.__insertMock.mockRejectedValueOnce(new Error('DB error'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    await expect(logAction('u', 'admin', 'ADD_ITEM', null, null, null)).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith('Audit log error:', 'DB error')
    consoleSpy.mockRestore()
  })
})
