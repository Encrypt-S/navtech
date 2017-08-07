'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../src/settings/private.settings.json')

let PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')

describe('[PrepareOutgoing]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.run({ junkParam: 1234 }, callback)
    })
    it('should set the runtime variables and fail to get the blockHeight', (done) => {
      const callback = () => {
        expect(PrepareOutgoing.runtime.callback).toBe(callback)
        expect(PrepareOutgoing.runtime.navClient).toBe(mockClient)
        expect(PrepareOutgoing.runtime.subClient).toBe(mockClient)
        expect(PrepareOutgoing.runtime.navBalance).toBe(50000)
        expect(PrepareOutgoing.runtime.settings).toEqual({ test: 1 })
        expect(PrepareOutgoing.runtime.failedSubTransactions).toEqual([])
        expect(PrepareOutgoing.runtime.currentBatch).toEqual([])
        expect(PrepareOutgoing.runtime.sumPending).toBe(0)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_001A')
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)

      const mockClient = {
        getBlockCount: () => {
          return Promise.reject({ code: -17 })
        },
      }

      PrepareOutgoing.run({
        navClient: mockClient,
        subClient: mockClient,
        navBalance: 50000,
        settings: { test: 1 },
      }, callback)
    })
    it('should set the runtime variables and call getUnspent', (done) => {
      PrepareOutgoing.getUnspent = () => {
        expect(PrepareOutgoing.runtime.callback).toBe(callback)
        expect(PrepareOutgoing.runtime.navClient).toBe(mockClient)
        expect(PrepareOutgoing.runtime.navClient).toBe(mockClient)
        expect(PrepareOutgoing.runtime.navBalance).toBe(50000)
        expect(PrepareOutgoing.runtime.settings).toEqual({ test: 1 })
        expect(PrepareOutgoing.runtime.failedSubTransactions).toEqual([])
        expect(PrepareOutgoing.runtime.currentBatch).toEqual([])
        expect(PrepareOutgoing.runtime.sumPending).toBe(0)
        done()
      }

      const callback = () => {}

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)

      const mockClient = {
        getBlockCount: () => {
          return Promise.resolve(1000)
        },
      }

      PrepareOutgoing.run({
        navClient: mockClient,
        subClient: mockClient,
        navBalance: 50000,
        settings: { test: 1 },
      }, callback)
    })
  })
  describe('(getUnspent)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should fail to list unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_002')
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.getUnspent()
    })
    it('should find no unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.resolve([]) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.getUnspent()
    })
    it('should find unspent and call the filter function', (done) => {
      const mockNavCoin = {
        filterUnspent: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PrepareOutgoing.unspentFiltered)
          expect(options.unspent).toBe(unspent)
          expect(options.client).toBe(mockClient)
          expect(options.accountName).toBe(privateSettings.account[globalSettings.serverType])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const unspent = [1, 2, 3, 4]
      const callback = () => {}
      const mockClient = {
        listUnspent: () => { return Promise.resolve(unspent) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.__set__('NavCoin', mockNavCoin)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.getUnspent()
    })
  })
  describe('(unspentFiltered)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should fail to filter the unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_003')
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.unspentFiltered(false)
    })
    it('should return true but have incorrect params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_003')
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.unspentFiltered(true, {
        junkParam: 1234,
      })
    })
    it('should return true but have no filtered pending', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_003')
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        callback,
      }
      PrepareOutgoing.unspentFiltered(true, {
        currentPending: [],
      })
    })
    it('should return the right data, set currentPending and call PruneUnspent', (done) => {
      PrepareOutgoing.processTransaction = () => {
        expect(PrepareOutgoing.runtime.currentPending).toBe(currentPending)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.runtime = {}
      const currentPending = [1, 2, 3, 4]
      PrepareOutgoing.unspentFiltered(true, {
        currentPending,
      })
    })
  })
  describe('(processTransaction)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should call getEncrypted on the next transaction to process', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.failedSubTransactions).toEqual([1, 2])
        expect(data.currentBatch).toEqual([3, 4])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      const currentPending = []
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        failedSubTransactions: [1, 2],
        currentBatch: [3, 4],
        callback,
        currentPending,
      }
      PrepareOutgoing.processTransaction()
    })
    it('should successfully exit with no more to process', (done) => {
      const EncryptedData = {
        getEncrypted: (options, parsedCallback) => {
          expect(options.transaction).toEqual(3)
          expect(options.client).toBe(mockClient)
          expect(parsedCallback).toBe(PrepareOutgoing.checkDecrypted)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }

      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.__set__('EncryptedData', EncryptedData)
      const currentPending = [3, 4]
      PrepareOutgoing.runtime = {
        subClient: mockClient,
        currentPending,
      }
      PrepareOutgoing.processTransaction()
    })
  })
  describe('(failedTransaction)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should successfully exit with no more to process', (done) => {
      PrepareOutgoing.processTransaction = () => {
        expect(PrepareOutgoing.runtime.currentPending).toEqual(4)
        expect(PrepareOutgoing.runtime.failedSubTransactions).toEqual(3)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      const currentPending = [3, 4]
      PrepareOutgoing.runtime = {
        currentPending,
        failedSubTransactions: [],
      }
      PrepareOutgoing.failedTransaction()
    })
  })
  describe('(checkDecrypted)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should fail to get the encrypted data', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_004')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(false)
    })
    it('should get the encrypted data but give wrong params', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_004')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { junkParam: '1234' })
    })
    it('should get the encrypted data but not return the transaction', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_004')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { decrypted: '1234' })
    })
    it('should get the encrypted data but the data is malformed', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_005')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { transaction: 1, decrypted: {
        x: 1,
        y: 2,
        z: 3,
      } })
    })
    it('should get the encrypted data but the amount is too much', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_006')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.runtime = {
        settings: {
          maxAmount: 10000,
        },
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { transaction: 1, decrypted: {
        n: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        v: 100000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        t: 100,
      } })
    })
    it('should get the encrypted data but the secret is wrong', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_007')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.runtime = {
        settings: {
          maxAmount: 10000,
          secret: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        },
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { transaction: 1, decrypted: {
        n: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        v: 1000,
        s: 'XYZ',
      } })
    })
    it('should get the encrypted data, set the time delay to 0 proceed to test it', (done) => {
      PrepareOutgoing.testDecrypted = (parsedDecrypted, parsedTransaction) => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(parsedDecrypted).toBe(decrypted)
        expect(parsedTransaction).toBe(transaction)
        expect(parsedDecrypted.t).toBe(0)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.runtime = {
        settings: {
          maxAmount: 10000,
          secret: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        },
      }
      const decrypted = {
        n: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        v: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { transaction, decrypted })
    })
    it('should get the encrypted data and proceed to test it', (done) => {
      PrepareOutgoing.testDecrypted = (parsedDecrypted, parsedTransaction) => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(parsedDecrypted).toBe(decrypted)
        expect(parsedTransaction).toBe(transaction)
        expect(parsedDecrypted.t).toBe(20)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareOutgoing.runtime = {
        settings: {
          maxAmount: 10000,
          secret: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        },
      }
      const decrypted = {
        n: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        v: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        t: 20,
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.checkDecrypted(true, { transaction, decrypted })
    })
  })
  describe('(testDecrypted)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareOutgoing = rewire('../src/lib/PrepareOutgoing')
    })
    it('should fail to try and validate the address', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_009')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockClient = {
        validateAddress: () => { return Promise.reject({ code: -17 }) },
      }
      const decrypted = {
        a: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        n: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.runtime = {
        navClient: mockClient,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.testDecrypted(decrypted, transaction)
    })
    it('should detect an invalid address', (done) => {
      PrepareOutgoing.failedTransaction = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPO_008')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: false }) },
      }
      const decrypted = {
        a: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        n: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.runtime = {
        navClient: mockClient,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.testDecrypted(decrypted, transaction)
    })
    it('should detect valid address but its not reached the required blockheight', (done) => {
      PrepareOutgoing.processTransaction = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(PrepareOutgoing.runtime.currentBatch).toEqual([])
        expect(PrepareOutgoing.runtime.currentPending).toEqual([2, 3])
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: true }) },
      }
      const decrypted = {
        a: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        n: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        t: 10000,
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.runtime = {
        navClient: mockClient,
        navBalance: 50000,
        sumPending: 0,
        currentBatch: [],
        currentPending: [1, 2, 3],
        currentBlockHeight: 1000,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.testDecrypted(decrypted, transaction)
    })
    it('should detect valid address and add it to the list', (done) => {
      PrepareOutgoing.processTransaction = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(PrepareOutgoing.runtime.currentBatch).toEqual([
          { decrypted, transaction },
        ])
        expect(PrepareOutgoing.runtime.currentPending).toEqual([2, 3])
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: true }) },
      }
      const decrypted = {
        a: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        n: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
        t: 10000,
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.runtime = {
        navClient: mockClient,
        navBalance: 50000,
        sumPending: 0,
        currentBatch: [],
        currentPending: [1, 2, 3],
        currentBlockHeight: 10000,
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.testDecrypted(decrypted, transaction)
    })
    it('should determine the list is full and run the callback', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: true }) },
      }
      const decrypted = {
        a: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        n: 1000,
        s: '5rgXsNYQ9y4lArEmWA1Wrh9ztUmoG2vZBx1SB1FnZX',
      }
      const transaction = {
        to: 'NKxkTEjTLARTUq4tz2i8Gzho8pHDYLLmWj',
        amount: 100,
      }
      PrepareOutgoing.runtime = {
        navClient: mockClient,
        navBalance: 50000,
        sumPending: 49500,
        currentBatch: [4, 5],
        failedSubTransactions: [{ tx: 10 }, { tx: 155 }],
        currentPending: [1, 2, 3],
        callback: (success, data) => {
          expect(data.failedSubTransactions).toEqual([{ tx: 10 }, { tx: 155 }])
          expect(data.currentBatch).toEqual([4, 5])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      PrepareOutgoing.__set__('Logger', mockLogger)
      PrepareOutgoing.testDecrypted(decrypted, transaction)
    })
  })
})
