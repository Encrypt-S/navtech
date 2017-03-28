'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

const privateSettings = require('../src/settings/private.settings.json')

let RefillOutgoing = rewire('../src/lib/RefillOutgoing')

describe('[RefillOutgoing]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.run({ junkParam: 1234 }, callback)
    })
    it('should get the right params and call getUnspent', (done) => {
      const callback = () => {}
      const navClient = {}
      RefillOutgoing.getUnspent = () => {
        expect(RefillOutgoing.runtime.callback).toBe(callback)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.run({ navClient }, callback)
    })
  })
  describe('(getUnspent)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should fail to get unspent', (done) => {
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -4 }) },
      }
      RefillOutgoing.runtime = {
        navClient: mockClient,
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RFL_003')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.getUnspent()
    })
    it('should get the unspent, but there are no transactions to process', (done) => {
      const mockClient = {
        listUnspent: () => { return Promise.resolve([]) },
      }
      RefillOutgoing.runtime = {
        navClient: mockClient,
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RFL_002')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.getUnspent()
    })
    it('should get the unspent and proceed to filter them', (done) => {
      const mockClient = {
        listUnspent: () => { return Promise.resolve([1, 2, 3]) },
      }
      RefillOutgoing.runtime = {
        navClient: mockClient,
        callback: () => {},
      }
      const NavCoin = {
        filterUnspent: (options, callback) => {
          expect(options.client).toBe(mockClient)
          expect(options.unspent).toEqual([1, 2, 3])
          expect(options.accountName).toBe(privateSettings.account.HOLDING)
          expect(callback).toBe(RefillOutgoing.holdingFiltered)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.__set__('NavCoin', NavCoin)
      RefillOutgoing.getUnspent()
    })
  })
  describe('(holdingFiltered)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should have no holding to process', (done) => {
      RefillOutgoing.runtime = {
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.message).toBeA('string')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingFiltered(false)
    })
    it('should have no holding to process', (done) => {
      RefillOutgoing.runtime = {
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.message).toBeA('string')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingFiltered(true, { currentPending: [] })
    })
    it('should find the holding transactions and run the processing function', (done) => {
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([1, 2, 3])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingFiltered(true, { currentPending: [1, 2, 3] })
    })
  })
  describe('(processHolding)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should run the callback when all holding are processed', (done) => {
      RefillOutgoing.runtime = {
        currentHolding: [],
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RFL_005')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.processHolding()
    })
    it('should continue to check if the holding transaction is spendable', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.checkIfHoldingIsSpendable = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.processHolding()
    })
  })
  describe('(checkIfHoldingIsSpendable)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should not process holding transaction because its below the confirmation threshold', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_006')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.checkIfHoldingIsSpendable()
    })
    it('should continue to get the encrypted data', (done) => {
      const hld1 = { confirmations: 5, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        navClient: {},
        currentHolding: [hld1, hld2],
      }
      const EncryptedData = {
        getEncrypted: (options, callback) => {
          expect(callback).toEqual(RefillOutgoing.holdingDecrypted)
          expect(options.transaction).toBe(hld1)
          expect(options.client).toBe(RefillOutgoing.runtime.navClient)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.__set__('EncryptedData', EncryptedData)
      RefillOutgoing.checkIfHoldingIsSpendable()
    })
  })
  describe('(holdingDecrypted)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should not process the holding because the encyptedData is bad (returned false)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_007')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingDecrypted(false, {})
    })
    it('should not process the holding because the encyptedData is bad (no decrypted)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_007')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingDecrypted(true, { junkParam: '1234' })
    })
    it('should not process the holding because the encyptedData is bad (no transaction)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_007')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingDecrypted(true, { decrypted: '1234' })
    })
    it('should abort if it is unable to JSON.parse the decrypted data', (done) => {
      const transaction = { confirmations: 10, amount: 500, txid: 'ABC' }
      const decrypted = 5
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_007A')
        done()
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.holdingDecrypted(true, { decrypted, transaction })
    })
    it('should figure out how many random transactions to make', (done) => {
      const transaction = { confirmations: 10, amount: 500, txid: 'ABC' }
      const decrypted = '["QWER", "ASDF", "ZXCV", "POIU", "LKJH", "MNBV"]'
      let i = 0
      const RandomizeTransactions = {
        incoming: (options, callback) => {
          expect(callback).toEqual(RefillOutgoing.checkRandomTransactions)
          expect(options.totalToSend).toBe(500)
          expect(options.addresses.length).toBeGreaterThanOrEqualTo(privateSettings.minNavTransactions)
          expect(options.addresses.length).toBeLessThanOrEqualTo(decrypted.length)
          sinon.assert.notCalled(mockLogger.writeLog)
          if (i === 100) done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.__set__('RandomizeTransactions', RandomizeTransactions)
      for (i; i <= 100; i++) { // run the function 100 times to make sure the random selection works
        RefillOutgoing.holdingDecrypted(true, { decrypted, transaction })
      }
    })
  })
  describe('(checkRandomTransactions)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should not receive bad randomized transactions (returned false)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_008')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.checkRandomTransactions(false, {})
    })
    it('should not receive bad randomized transactions (bad params)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_008')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.checkRandomTransactions(true, { junkParam: 'ASDF' })
    })
    it('should not receive bad randomized transactions (no transactions)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_008')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.checkRandomTransactions(true, { transactions: [] })
    })
    it('should continue and run the sendRawRefillTransaction function', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
      }
      RefillOutgoing.sendRawRefillTransaction = (outgoingTransactions) => {
        expect(outgoingTransactions).toEqual([1, 2, 3, 4])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.checkRandomTransactions(true, { transactions: [1, 2, 3, 4] })
    })
  })
  describe('(sendRawRefillTransaction)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should create the spent transactions array and call the rawTransaction function', (done) => {
      const outgoingTransactions = ['X', 'Y', 'Z']
      RefillOutgoing.runtime = {
        holdingTransaction: {
          txid: 'XYZ',
          vout: 1,
        },
      }
      const SendRawTransaction = {
        createRaw: (options, callback) => {
          expect(options.outgoingTransactions).toBe(outgoingTransactions)
          expect(options.spentTransactions).toEqual([{
            txid: 'XYZ',
            vout: 1,
          }])
          expect(callback).toBe(RefillOutgoing.refillSent)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.__set__('SendRawTransaction', SendRawTransaction)
      RefillOutgoing.sendRawRefillTransaction(outgoingTransactions)
    })
  })
  describe('(refillSent)', () => {
    before(() => { // reset the rewired functions
      RefillOutgoing = rewire('../src/lib/RefillOutgoing')
    })
    it('should not fail to send the raw holding transaction (returned false)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
        holdingTransaction: {
          txid: 'XYZ',
          vout: 1,
        },
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_009')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.refillSent(false, {})
    })
    it('should not fail to send the raw holding transaction (no rawOutcome)', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
        holdingTransaction: {
          txid: 'XYZ',
          vout: 1,
        },
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RFL_009')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.refillSent(true, { junkParam: '1234' })
    })
    it('should send the raw holding transaction and move onto the next holding transaction', (done) => {
      const hld1 = { confirmations: 0, amount: 100, txid: 'XYZ' }
      const hld2 = { confirmations: 10, amount: 500, txid: 'ABC' }
      RefillOutgoing.runtime = {
        currentHolding: [hld1, hld2],
        holdingTransaction: {
          txid: 'XYZ',
          vout: 1,
        },
      }
      RefillOutgoing.processHolding = () => {
        expect(RefillOutgoing.runtime.currentHolding).toEqual([hld2])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RefillOutgoing.__set__('Logger', mockLogger)
      RefillOutgoing.refillSent(true, { rawOutcome: '1234' })
    })
  })
})
