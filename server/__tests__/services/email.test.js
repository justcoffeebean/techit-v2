const mockSendMail = jest.fn().mockResolvedValue({})

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}))

process.env.EMAIL_USER = 'test@gmail.com'
process.env.EMAIL_PASS = 'password'
process.env.LOW_STOCK_EMAIL = 'alerts@company.com'

const { sendLowStockAlert } = require('../../services/email')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('sendLowStockAlert', () => {
  it('does nothing when items is null', async () => {
    await sendLowStockAlert(null)
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('does nothing when items is an empty array', async () => {
    await sendLowStockAlert([])
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('sends an email with correct subject for a single item', async () => {
    const items = [{ name: 'Widget', sku: 'W-001', quantity: 3, status: 'Low Stock' }]

    await sendLowStockAlert(items)

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const call = mockSendMail.mock.calls[0][0]
    expect(call.from).toBe('test@gmail.com')
    expect(call.to).toBe('alerts@company.com')
    expect(call.subject).toContain('1 item(s) need restocking')
    expect(call.html).toContain('Widget')
    expect(call.html).toContain('W-001')
    expect(call.html).toContain('3 units')
  })

  it('sends an email with correct subject for multiple items', async () => {
    const items = [
      { name: 'Widget', sku: 'W-001', quantity: 3, status: 'Low Stock' },
      { name: 'Gadget', sku: 'G-001', quantity: 0, status: 'Out of Stock' },
    ]

    await sendLowStockAlert(items)

    const call = mockSendMail.mock.calls[0][0]
    expect(call.subject).toContain('2 item(s) need restocking')
    expect(call.html).toContain('Widget')
    expect(call.html).toContain('Gadget')
  })

  it('applies red color for out-of-stock items (quantity 0)', async () => {
    const items = [{ name: 'Widget', sku: 'W-001', quantity: 0, status: 'Out of Stock' }]

    await sendLowStockAlert(items)

    const call = mockSendMail.mock.calls[0][0]
    expect(call.html).toContain('#f87171')
  })

  it('applies orange color for low-stock items (quantity > 0)', async () => {
    const items = [{ name: 'Widget', sku: 'W-001', quantity: 5, status: 'Low Stock' }]

    await sendLowStockAlert(items)

    const call = mockSendMail.mock.calls[0][0]
    expect(call.html).toContain('#fb923c')
  })
})
