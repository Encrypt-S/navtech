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
    before(() => { // reset the rewired functions
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
    it('should reset the partial transaction array and create random transactions', (done) => {
      const remainingTransactions = [
        {
          decrypted: {
            v: 10,
            n: 'XYZ',
          },
        },
        {
          decrypted: {
            v: 100,
            n: 'XYZ',
          },
        },
      ]
      ProcessOutgoing.runtime = {
        remainingTransactions,
        successfulTransactions: [],
        failedTransactions: [],
        callback: () => {},
      }
      const RandomizeTransactions = {
        outgoing: (options, callback) => {
          expect(options.transaction).toBe(remainingTransactions[0])
          expect(options.amount).toBe(10)
          expect(options.address).toBe('XYZ')
          expect(callback).toBe(ProcessOutgoing.amountsRandomized)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.__set__('RandomizeTransactions', RandomizeTransactions)
      ProcessOutgoing.processPending()
    })
  })
  describe('(transactionFailed)', () => {
    before(() => { // reset the rewired functions
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
  describe('(amountsRandomized)', () => {
    before(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should fail to randomize the transactions', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      ProcessOutgoing.transactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_002')
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.amountsRandomized(false, { junkParam: 1234 })
    })
    it('should randomize the transactions and call createNavTransactions', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      ProcessOutgoing.runtime = {}

      ProcessOutgoing.createNavTransactions = () => {
        expect(ProcessOutgoing.runtime.partialTransactions).toEqual([1, 2, 3])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.amountsRandomized(true, { partialTransactions: [1, 2, 3] })
    })
  })
  describe('(mockSend)', () => {
    before(() => { // reset the rewired functions
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
  describe('(createNavTransactions)', () => {
    before(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should still have pending partials and call the send function', (done) => {
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
      const remainingTransactions = [
        tx1,
      ]
      ProcessOutgoing.runtime = {
        remainingTransactions,
        partialTransactions: [1, 2, 3],
        successfulTransactions: [],
        failedTransactions: [],
        navClient: () => {},
      }

      const SendToAddress = {
        send: (options, callback) => {
          expect(options.client).toBe(ProcessOutgoing.runtime.navClient)
          expect(options.address).toBe('XYZ')
          expect(options.amount).toBe(1)
          expect(options.transaction).toBe(tx1)
          expect(callback).toBe(ProcessOutgoing.sentPartialNav)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.__set__('SendToAddress', SendToAddress)
      ProcessOutgoing.createNavTransactions(false, { junkParam: 1234 })
    })
    it('should recognize that all the partials have been sent and move onto the next record', (done) => {
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
        partialTransactions: [],
        successfulTransactions: [],
        failedTransactions: [],
        callback: () => {},
      }

      ProcessOutgoing.processPending = () => {
        expect(ProcessOutgoing.runtime.successfulTransactions).toEqual([{ transaction: tx1.transaction }])
        expect(ProcessOutgoing.runtime.remainingTransactions).toEqual([tx2])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROO_003')
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.createNavTransactions(false, { junkParam: 1234 })
    })
  })
  describe('(sentPartialNav)', () => {
    before(() => { // reset the rewired functions
      ProcessOutgoing = rewire('../src/lib/ProcessOutgoing')
    })
    it('should fail to send partial nav (returned false) and exit the current process', (done) => {
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
        partialTransactions: [2, 3, 4],
        failedTransactions: [],
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.failedTransaction).toBe(tx1)
          expect(data.remainingPartials).toEqual([2, 3, 4])
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
          done()
        },
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentPartialNav(false, { junkParam: 1234 })
    })
    it('should fail to send partial nav (bad data) and exit the current process', (done) => {
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
        partialTransactions: [2, 3, 4],
        failedTransactions: [],
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.failedTransaction).toBe(tx1)
          expect(data.remainingPartials).toEqual([2, 3, 4])
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
          done()
        },
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentPartialNav(true, { junkParam: 1234 })
    })
    it('should fail to send partial (no data) nav and exit the current process', (done) => {
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
        partialTransactions: [2, 3, 4],
        failedTransactions: [],
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.failedTransaction).toBe(tx1)
          expect(data.remainingPartials).toEqual([2, 3, 4])
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PROO_004')
          done()
        },
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentPartialNav(true)
    })
    it('should successfully send the partial nav and try the next partial', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ProcessOutgoing.runtime = {
        partialTransactions: [2, 3, 4],
      }

      ProcessOutgoing.createNavTransactions = () => {
        expect(ProcessOutgoing.runtime.partialTransactions).toEqual([3, 4])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      ProcessOutgoing.__set__('Logger', mockLogger)
      ProcessOutgoing.sentPartialNav(true, { sendOutcome: '1234' })
    })
  })
})
