'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')

describe('[ProcessOutgoing]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.run({ junkParam: 1234 }, callback)
    })
    it('should set the runtime variables and call getUnspent', (done) => {
      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.callback).toBe(callback)
        expect(ProcessOutgoing.runtime.navClient).toBe(mockClient)
        expect(ProcessOutgoing.runtime.settings).toEqual({ test: 1 })
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([])
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const callback = () => {}

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.__set__('Logger', mockLogger)

      const mockClient = {
        getAccountAddress: () => { return Promise.reject({ code: -17 }) },
      }

      ProcessOutgoing.run({
        navClient: mockClient,
        currentBatch: [1, 2, 3],
        settings: { test: 1 },
      }, callback)
    })
  })
  describe('(processPending)', () => {
    beforeEach(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should run the callback when no more transactions are left to process', (done) => {
      ProcessOutgoing.runtime = {
        remainingTransactions: [],
        successfulTransactions: [1, 2, 3],
        failedTransactions: [4, 5, 6],
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.successfulTransactions).toEqual([1, 2, 3])
          expect(data.failedTransactions).toEqual([4, 5, 6])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.processPending()
    })
    it('should run the SendToAddress.send when it has remaining transactions to process', (done) => {
      ProcessOutgoing.runtime = {
        remainingTransactions: [
          { txid: 1234, decrypted: { n: 'ASDF', v: 333 } },
          { txid: 5678, decrypted: { n: 'QWER', v: 222 } },
        ],
        successfulTransactions: [1, 2, 3],
        failedTransactions: [4, 5, 6],
        navClient: { getInfo: true },
      }
      const SendToAddress = {
        send: (options, callback) => {
          expect(callback).toBe(ProcessOutgoing.sentNav)
          expect(options.client).toBe(ProcessOutgoing.runtime.navClient)
          expect(options.address).toBe('ASDF')
          expect(options.amount).toBe(333)
          expect(options.transaction).toEqual({ txid: 1234, decrypted: { n: 'ASDF', v: 333 } })
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.__set__('SendToAddress', SendToAddress)
      ProcessOutgoing.processPending()
    })
  })
  describe('(transactionFailed)', () => {
    beforeEach(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should trim the failed transaction and move onto the next one', (done) => {
      ProcessOutgoing.runtime = {
        remainingTransactions: [1, 2, 3],
        successfulTransactions: [],
        failedTransactions: [],
        callback: () => {},
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([1])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([2, 3])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.transactionFailed()
    })
  })
  describe('(mockSend)', () => {
    beforeEach(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should pretend a successful send happened for testing purposes', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const tx1 = {
        transaction: { txid: '1234' },
        decrypted: {
          v: 10,
          n: 'XYZ',
        },
      }
      const tx2 = {
        transaction: { txid: '4321' },
        decrypted: {
          v: 100,
          n: 'ZYX',
        },
      }
      const remainingTransactions = [
        tx1,
        tx2,
      ]
      ProcessOutgoing.runtime = {
        remainingTransactions,
        successfulTransactions: [],
        failedTransactions: [],
        callback: () => {},
      }

      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([{ transaction: tx1.transaction }])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_003A')
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.mockSend()
    })
  })
  describe('(sentNav)', () => {
    beforeEach(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should fail to send partial nav (returned false) and try the next one', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const tx1 = {
        transaction: { txid: '1234' },
        decrypted: {
          v: 10,
          n: 'XYZ',
        },
      }
      const tx2 = {
        transaction: { txid: '4321' },
        decrypted: {
          v: 100,
          n: 'ZYX',
        },
      }
      const remainingTransactions = [
        tx1,
        tx2,
      ]
      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([tx1])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
        done()
      }
      ProcessOutgoing.runtime = {
        remainingTransactions,
        failedTransactions: [],
        successfulTransactions: [],
        callback: () => {},
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentNav(false, { junkParam: 1234 })
    })
    it('should fail to send partial nav (bad data) and try the next one', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const tx1 = {
        transaction: { txid: '1234' },
        decrypted: {
          v: 10,
          n: 'XYZ',
        },
      }
      const tx2 = {
        transaction: { txid: '4321' },
        decrypted: {
          v: 100,
          n: 'ZYX',
        },
      }
      const remainingTransactions = [
        tx1,
        tx2,
      ]
      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([tx1])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
        done()
      }
      ProcessOutgoing.runtime = {
        remainingTransactions,
        failedTransactions: [],
        successfulTransactions: [],
        callback: () => {},
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentNav(true, { junkParam: 1234 })
    })
    it('should fail to send partial (no data) nav and try the next one', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const tx1 = {
        transaction: { txid: '1234' },
        decrypted: {
          v: 10,
          n: 'XYZ',
        },
      }
      const tx2 = {
        transaction: { txid: '4321' },
        decrypted: {
          v: 100,
          n: 'ZYX',
        },
      }
      const remainingTransactions = [
        tx1,
        tx2,
      ]
      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([tx1])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
        done()
      }
      ProcessOutgoing.runtime = {
        remainingTransactions,
        failedTransactions: [],
        successfulTransactions: [],
        callback: () => {},
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentNav(true)
    })
    it('should successfully send the partial nav and try the next partial', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const tx1 = {
        transaction: { txid: '1234' },
        decrypted: {
          v: 10,
          n: 'XYZ',
        },
      }
      const tx2 = {
        transaction: { txid: '4321' },
        decrypted: {
          v: 100,
          n: 'ZYX',
        },
      }
      const remainingTransactions = [
        tx1,
        tx2,
      ]
      ProcessOutgoing.runtime = {
        remainingTransactions,
        failedTransactions: [],
        successfulTransactions: [],
      }

      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.failedTransactions).toEqual([])
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([tx1])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentNav(true, { sendOutcome: '1234' })
    })
  })
})
