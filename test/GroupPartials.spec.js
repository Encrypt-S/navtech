'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let GroupPartials = rewire('../src/lib/GroupPartials')

describe('[GroupPartials]', () => {
  describe('(run)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.run({ junkParam: 1234 }, callback)
    })
    it('should receive correct params and call getDecryptedData', (done) => {
      GroupPartials.getDecryptedData = () => {
        expect(GroupPartials.runtime.client).toEqual(client)
        expect(GroupPartials.runtime.currentPending).toEqual(currentPending)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const currentPending = [{ txid: 1 }, { txid: 2 }, { txid: 3 }]
      const client = {
        getBlockCount: () => 10000,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const callback = () => {}
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.run({ currentPending, client }, callback)
    })
  })
  describe('(getDecryptedData)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('it should call checkPartials if there are no more to process', (done) => {
      GroupPartials.checkPartials = () => {
        expect(GroupPartials.runtime.remainingToDecrypt.length).toBe(0)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const currentPending = [{ txid: 'ABC' }, { txid: 'DEF' }, { txid: 'GHI' }]
      GroupPartials.runtime = {
        client: {
          getBlockCount: () => 10000,
        },
        currentPending,
        remainingToDecrypt: [],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.getDecryptedData()
    })
    it('it should decrypt the current partial if there are more to be processed', (done) => {
      const mockEncryptedData = {
        getEncrypted: (options, callback) => {
          expect(options.transaction).toEqual({ txid: 'ABC' })
          expect(options.client).toEqual(GroupPartials.runtime.client)
          expect(callback).toBe(GroupPartials.checkDecrypted)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const currentPending = [{ txid: 'ABC' }, { txid: 'DEF' }, { txid: 'GHI' }]
      GroupPartials.runtime = {
        client: {
          getBlockCount: () => 10000,
        },
        currentPending,
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.__set__('EncryptedData', mockEncryptedData)
      GroupPartials.getDecryptedData()
    })
  })
  describe('(checkDecrypted)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('should move to the next transaction if decryption failed (returned false)', (done) => {
      const currentPending = [{ txid: 'ABC' }, { txid: 'DEF' }, { txid: 'GHI' }]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_002')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(false)
    })
    it('should move to the next transaction if decryption failed (returned bad params)', (done) => {
      const currentPending = [{ txid: 'ABC' }, { txid: 'DEF' }, { txid: 'GHI' }]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_002')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, { junkParam: true })
    })
    it('should move to the next transaction if decryption failed (returned no transaction data)', (done) => {
      const currentPending = [{ txid: 'ABC' }, { txid: 'DEF' }, { txid: 'GHI' }]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_002')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, { decrypted: true })
    })
    it('should move to the next transaction if the decrypted data didnt contain the right params', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_003')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, {
        decrypted: { junkParam: true },
        transaction: { txid: 'ABC', amount: 100 },
      })
    })
    it('should move to the next transaction if the decrypted data didnt contain all the needed params', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_003')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, {
        decrypted: { n: 'XYZ', t: 20, p: 1, o: 3, x: 'junk' },
        transaction: { txid: 'ABC', amount: 100 },
      })
    })
    it('should call reject the transaction if the decrypted address doesnt validate', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_003A')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        client: {
          validateAddress: () => {
            return Promise.resolve({ isvalid: false })
          },
        },
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, {
        decrypted: { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' },
        transaction: { txid: 'ABC', amount: 100 },
      })
    })
    it('should call reject the transaction if the the daemon failed to run the validation', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_003B')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        client: {
          validateAddress: () => {
            return Promise.reject({ err: -21 })
          },
        },
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, {
        decrypted: { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' },
        transaction: { txid: 'ABC', amount: 100 },
      })
    })
    it('should call groupPartials if everything is correct', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.groupPartials = (decrypted, transaction) => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(transaction).toEqual(currentPending[0])
        expect(decrypted).toEqual({ n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' })
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        client: {
          validateAddress: () => {
            return Promise.resolve({ isvalid: true })
          },
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkDecrypted(true, {
        decrypted: { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' },
        transaction: { txid: 'ABC', amount: 100 },
      })
    })
  })
  describe('(groupPartials)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('should reject the partial if the partial group is already marked as complete', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_006')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        partials: {
          12345: {
            destination: '123',
            readyToProcess: true,
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' }
      const transaction = { txid: 'ABC', amount: 100 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should reject the partial if the destination doesnt match the existing one', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_004')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        partials: {
          12345: {
            destination: '123',
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' }
      const transaction = { txid: 'ABC', amount: 100 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should reject the partial if the transaction id already exists in the partials list', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100 },
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.partialFailed = (transaction) => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'GRP_005')
        expect(transaction).toEqual(currentPending[0])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        partials: {
          12345: {
            destination: 'XYZ',
            transactions: {
              ABC: { txid: 'ABC', amount: 100 },
            },
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' }
      const transaction = { txid: 'ABC', amount: 100 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should not mark the transaction partials as ready and call getDecryptedData', (done) => {
      const currentPending = [
        { txid: 'DEF', amount: 100 },
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt[0]).toEqual({ txid: 'GHI', amount: 100 })
        expect(GroupPartials.runtime.partials[12345].readyToProcess).toBe(false)
        expect(GroupPartials.runtime.partials[12345].amount).toBe(200)
        expect(GroupPartials.runtime.partials[12345].partsSum).toBe(3)
        expect(GroupPartials.runtime.partials[12345].transactions).toEqual({
          ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
          DEF: { txid: 'DEF', amount: 100, part: 2, vout: 1, vin: 2, confirmations: 20 },
        })
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        partials: {
          12345: {
            destination: 'XYZ',
            unique: '12345',
            timeDelay: 20,
            parts: 3,
            partsSum: 1,
            amount: 100,
            transactions: {
              ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
            },
            readyToProcess: false,
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 2, o: 3, u: '12345' }
      const transaction = { txid: 'DEF', amount: 100, vout: 1, vin: 2, confirmations: 20 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should mark the transaction partials as ready and call getDecryptedData', (done) => {
      const currentPending = [
        { txid: 'GHI', amount: 100 },
      ]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([])
        expect(GroupPartials.runtime.partials[12345].amount).toBe(300)
        expect(GroupPartials.runtime.partials[12345].partsSum).toBe(6)
        expect(GroupPartials.runtime.partials[12345].transactions).toEqual({
          ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
          DEF: { txid: 'DEF', amount: 100, part: 2, vout: 1, vin: 2, confirmations: 20 },
          GHI: { txid: 'GHI', amount: 100, part: 3, vout: 1, vin: 2, confirmations: 20 },
        })
        expect(GroupPartials.runtime.partials[12345].readyToProcess).toBe(true)
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        readyToProcess: {},
        partials: {
          12345: {
            destination: 'XYZ',
            unique: '12345',
            timeDelay: 20,
            parts: 3,
            partsSum: 3,
            amount: 200,
            transactions: {
              ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
              DEF: { txid: 'DEF', amount: 100, part: 2, vout: 1, vin: 2, confirmations: 20 },
            },
            readyToProcess: false,
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 3, o: 3, u: '12345' }
      const transaction = { txid: 'GHI', amount: 100, vout: 1, vin: 2, confirmations: 20 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('if this unique has not been seen yet, it should create the obect', (done) => {
      const currentPending = [
        { txid: 'ABC', amount: 100, vout: 1, vin: 2, confirmations: 20 },
        { txid: 'DEF', amount: 100, vout: 1, vin: 2, confirmations: 20 },
        { txid: 'GHI', amount: 100, vout: 1, vin: 2, confirmations: 20 },
      ]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([
          { txid: 'DEF', amount: 100, vout: 1, vin: 2, confirmations: 20 },
          { txid: 'GHI', amount: 100, vout: 1, vin: 2, confirmations: 20 },
        ])
        expect(GroupPartials.runtime.partials[12345].amount).toBe(100)
        expect(GroupPartials.runtime.partials[12345].partsSum).toBe(1)
        expect(GroupPartials.runtime.partials[12345].transactions).toEqual({
          ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
        })
        expect(GroupPartials.runtime.partials[12345].readyToProcess).toBe(false)
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        readyToProcess: {},
        partials: {
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 1, o: 3, u: '12345' }
      const transaction = { txid: 'ABC', amount: 100, vout: 1, vin: 2, confirmations: 20 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should complete even when in the wrong order', (done) => {
      const currentPending = [
        { txid: 'GHI', amount: 100, vout: 1, vin: 2, confirmations: 20 },
      ]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([])
        expect(GroupPartials.runtime.partials[12345].amount).toBe(300)
        expect(GroupPartials.runtime.partials[12345].partsSum).toBe(6)
        expect(GroupPartials.runtime.partials[12345].transactions).toEqual({
          ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
          DEF: { txid: 'DEF', amount: 100, part: 3, vout: 1, vin: 2, confirmations: 20 },
          GHI: { txid: 'GHI', amount: 100, part: 2, vout: 1, vin: 2, confirmations: 20 },
        })
        expect(GroupPartials.runtime.partials[12345].readyToProcess).toBe(true)
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        readyToProcess: {},
        partials: {
          12345: {
            destination: 'XYZ',
            unique: '12345',
            timeDelay: 20,
            parts: 3,
            partsSum: 4,
            amount: 200,
            transactions: {
              ABC: { txid: 'ABC', amount: 100, part: 1, vout: 1, vin: 2, confirmations: 20 },
              DEF: { txid: 'DEF', amount: 100, part: 3, vout: 1, vin: 2, confirmations: 20 },
            },
            readyToProcess: false,
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 2, o: 3, u: '12345' }
      const transaction = { txid: 'GHI', amount: 100, vout: 1, vin: 2, confirmations: 20 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
    it('should work with long unsafe amounts', (done) => {
      const currentPending = [
        { txid: 'GHI', amount: 100.33333333, vout: 1, vin: 2, confirmations: 20 },
      ]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([])
        expect(GroupPartials.runtime.partials[12345].amount).toBe(300.66666666)
        expect(GroupPartials.runtime.partials[12345].partsSum).toBe(6)
        expect(GroupPartials.runtime.partials[12345].transactions).toEqual({
          ABC: { txid: 'ABC', amount: 100.33333333, part: 1, vout: 1, vin: 2, confirmations: 20 },
          DEF: { txid: 'DEF', amount: 100, part: 3, vout: 1, vin: 2, confirmations: 20 },
          GHI: { txid: 'GHI', amount: 100.33333333, part: 2, vout: 1, vin: 2, confirmations: 20 },
        })
        expect(GroupPartials.runtime.partials[12345].readyToProcess).toBe(true)
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
        readyToProcess: {},
        partials: {
          12345: {
            destination: 'XYZ',
            unique: '12345',
            timeDelay: 20,
            parts: 3,
            partsSum: 4,
            amount: 200.33333333,
            transactions: {
              ABC: { txid: 'ABC', amount: 100.33333333, part: 1, vout: 1, vin: 2, confirmations: 20 },
              DEF: { txid: 'DEF', amount: 100, part: 3, vout: 1, vin: 2, confirmations: 20 },
            },
            readyToProcess: false,
          },
        },
      }
      const decrypted = { n: 'XYZ', t: 20, p: 2, o: 3, u: '12345' }
      const transaction = { txid: 'GHI', amount: 100.33333333, vout: 1, vin: 2, confirmations: 20 }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.groupPartials(decrypted, transaction)
    })
  })
  describe('(partialFailed)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('should add the transaction to the return list and move on', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([{ txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }])
        expect(GroupPartials.runtime.transactionsToReturn).toEqual([{ txid: 'GHI', amount: 100 }])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.partialFailed(transaction)
    })
    it('should not add the duplicate transaction to the return list and move on', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      GroupPartials.getDecryptedData = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(GroupPartials.runtime.remainingToDecrypt).toEqual([{ txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }])
        expect(GroupPartials.runtime.transactionsToReturn).toEqual([{ txid: 'GHI', amount: 100 }])
        done()
      }
      GroupPartials.runtime = {
        remainingToDecrypt: currentPending,
        transactionsToReturn: [{ txid: 'GHI', amount: 100 }],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.partialFailed(transaction)
    })
  })
  describe('(checkPartials)', () => {
    beforeEach(() => {
      GroupPartials = rewire('../src/lib/GroupPartials')
    })
    it('should have no partials ready to process', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      const partials = {
        11111: {
          unique: '11111',
          transactions: {
            GHI: { txid: 'GHI', amount: 100, confirmations: 10 },
            ABC: { txid: 'ABC', amount: 100, confirmations: 10 },
          },
          readyToProcess: false,
        },
      }
      GroupPartials.runtime = {
        currentPending,
        transactionsToReturn: [],
        readyToProcess: [],
        partials,
        callback: (success, data) => {
          console.log(data)
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(success).toBe(true)
          expect(data.readyToProcess).toEqual([])
          expect(data.transactionsToReturn).toEqual([])
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkPartials(transaction)
    })
    it('should reject partials that were too old to process', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      const partials = {
        11111: {
          unique: '11111',
          transactions: {
            GHI: { txid: 'GHI', amount: 100, confirmations: 1000 },
            ABC: { txid: 'ABC', amount: 100, confirmations: 1000 },
          },
          readyToProcess: false,
        },
      }
      GroupPartials.runtime = {
        currentPending,
        transactionsToReturn: [],
        readyToProcess: [],
        partials,
        callback: (success, data) => {
          console.log(data)
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(success).toBe(true)
          expect(data.readyToProcess).toEqual([])
          expect(data.transactionsToReturn).toEqual([
            { txid: 'GHI', amount: 100, confirmations: 1000 },
            { txid: 'ABC', amount: 100, confirmations: 1000 },
          ])
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkPartials(transaction)
    })
    it('should have partials to process', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      const partials = {
        11111: {
          unique: '11111',
          transactions: {
            GHI: { txid: 'GHI', amount: 100, confirmations: 1000 },
            ABC: { txid: 'ABC', amount: 100, confirmations: 1000 },
          },
          readyToProcess: true,
        },
      }
      GroupPartials.runtime = {
        currentPending,
        transactionsToReturn: [],
        readyToProcess: partials,
        partials,
        callback: (success, data) => {
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(success).toBe(true)
          expect(data.readyToProcess).toEqual(partials)
          expect(data.transactionsToReturn).toEqual([])
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkPartials(transaction)
    })
    it('should return a mix of ready and return transactions', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      const partials = {
        11111: {
          unique: '11111',
          transactions: {
            GHI: { txid: 'GHI', amount: 100, confirmations: 1000 },
            ABC: { txid: 'ABC', amount: 100, confirmations: 1000 },
          },
          readyToProcess: true,
        },
        22222: {
          unique: '22222',
          transactions: {
            DEF: { txid: 'DEF', amount: 100, confirmations: 1000 },
          },
          readyToProcess: false,
        },
      }
      GroupPartials.runtime = {
        currentPending,
        transactionsToReturn: [],
        readyToProcess: { 11111: partials[11111] },
        partials,
        callback: (success, data) => {
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(success).toBe(true)
          expect(data.readyToProcess).toEqual({ 11111: partials[11111] })
          expect(data.transactionsToReturn).toEqual([partials[22222].transactions.DEF])
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkPartials(transaction)
    })
    it('should return a mix of ready and return transactions', (done) => {
      const transaction = { txid: 'GHI', amount: 100 }
      const currentPending = [{ txid: 'GHI', amount: 100 }, { txid: 'ABC', amount: 100 }, { txid: 'DEF', amount: 100 }]
      const partials = {
        11111: {
          unique: '11111',
          transactions: {
            GHI: { txid: 'GHI', amount: 100, confirmations: 1000 },
            ABC: { txid: 'ABC', amount: 100, confirmations: 1000 },
          },
          readyToProcess: true,
        },
        22222: {
          unique: '22222',
          transactions: {
            DEF: { txid: 'DEF', amount: 100, confirmations: 1000 },
          },
          readyToProcess: false,
        },
      }
      GroupPartials.runtime = {
        currentPending,
        transactionsToReturn: [],
        readyToProcess: { 11111: partials[11111] },
        partials,
        callback: (success, data) => {
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(success).toBe(true)
          expect(data.readyToProcess).toEqual({ 11111: partials[11111] })
          expect(data.transactionsToReturn).toEqual([partials[22222].transactions.DEF])
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      GroupPartials.__set__('Logger', mockLogger)
      GroupPartials.checkPartials(transaction)
    })
  })
})
