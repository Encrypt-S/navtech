'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let SendRawTransaction = rewire('../src/lib/SendRawTransaction')

describe('[SendRawTransaction]', () => {
  describe('(run)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ junkParam: 1234 }, callback)
    })
    it('should get the right params and run create without encrypted', (done) => {
      const callback = () => {}
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.reject({ code: -4 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.create = () => {
        expect(SendRawTransaction.runtime.spentTransactions).toBe(spentTransactions)
        expect(SendRawTransaction.runtime.outgoingTransactions).toBe(outgoingTransactions)
        expect(SendRawTransaction.runtime.client).toBe(client)
        expect(SendRawTransaction.runtime.callback).toBe(callback)
        expect(SendRawTransaction.runtime.counter).toBe(0)
        expect(SendRawTransaction.runtime.encrypted).toBe(false)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client }, callback)
    })
    it('should get the right params and run create with encrypted', (done) => {
      const callback = () => {}
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.reject({ code: -4 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.create = () => {
        expect(SendRawTransaction.runtime.spentTransactions).toBe(spentTransactions)
        expect(SendRawTransaction.runtime.outgoingTransactions).toBe(outgoingTransactions)
        expect(SendRawTransaction.runtime.client).toBe(client)
        expect(SendRawTransaction.runtime.callback).toBe(callback)
        expect(SendRawTransaction.runtime.counter).toBe(0)
        expect(SendRawTransaction.runtime.encrypted).toBe('1234')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client, encrypted: '1234' }, callback)
    })
  })
  describe('(create)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should get the right params and fail to create the transaction without encrypted', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.runtime = {
        spentTransactions: [1, 2, 3],
        outgoingTransactions: { x: 1, y: 2, z: 3 },
        client: {
          createRawTransaction: () => { return Promise.reject({ code: -4 }) },
        },
        counter: 0,
        callback: () => {}
      }

      SendRawTransaction.retry = (error) => {
        expect(error.code).toBe(-4)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_003')
        done()
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.create()
    })
    it('should get the right params and fail to create the transaction with encrypted', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.runtime = {
        spentTransactions: [1, 2, 3],
        outgoingTransactions: { x: 1, y: 2, z: 3 },
        client: {
          createRawTransaction: () => { return Promise.reject({ code: -4 }) },
        },
        counter: 0,
        encrypted: '1234',
        callback: () => {}
      }
      SendRawTransaction.retry = (error) => {
        expect(error.code).toBe(-4)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_002')
        done()
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.create()
    })
    it('should get the right params and call signRaw (no encrypted)', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.runtime = {
        spentTransactions: [1, 2, 3],
        outgoingTransactions: { x: 1, y: 2, z: 3 },
        client: {
          createRawTransaction: () => { return Promise.resolve('RAW_TRANSACTION') },
        },
        counter: 0,
        callback: () => {}
      }

      SendRawTransaction.signRaw = (rawTrans) => {
        expect(rawTrans).toBe('RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.create()
    })
    it('should get the right params and call signRaw (encrypted)', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.runtime = {
        spentTransactions: [1, 2, 3],
        outgoingTransactions: { x: 1, y: 2, z: 3 },
        client: {
          createRawTransaction: () => { return Promise.resolve('RAW_TRANSACTION') },
        },
        counter: 0,
        encrypted: 'ENCRYPTED_DATA',
        callback: () => {}
      }

      SendRawTransaction.signRaw = (rawTrans) => {
        expect(rawTrans).toBe('RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.create()
    })
  })
  describe('(signRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should fail to sign the raw transaction', (done) => {
      SendRawTransaction.runtime = {
        spentTransactions: [1, 2, 3],
        outgoingTransactions: { x: 1, y: 2, z: 3 },
        client: {
          signRawTransaction: () => { return Promise.reject({ code: -23 }) },
        },
        counter: 0,
        callback: () => {}
      }

      SendRawTransaction.retry = (error) => {
        expect(error.code).toBe(-23)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_004')
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw('RAW_TRANSACTION')
    })
    it('should fail to sign the raw transaction and attempt to unlock the wallet (navCoin)', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.reject({ code: -13 }) },
        port: '44444',
      }

      SendRawTransaction.runtime = {
        callback,
        client,
      }

      const NavCoin = {
        unlockWallet: (options, parsedCallback) => {
          expect(parsedCallback).toBe(SendRawTransaction.walletUnlocked)
          expect(options.client).toBe(client)
          expect(options.type).toBe('navCoin')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('NavCoin', NavCoin)
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw('RAW_TRANSACTION')
    })
    it('should fail to sign the raw transaction and attempt to unlock the wallet (subChain)', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.reject({ code: -13 }) },
        port: '33333',
      }

      SendRawTransaction.runtime = {
        callback,
        client,
      }

      const NavCoin = {
        unlockWallet: (options, parsedCallback) => {
          expect(parsedCallback).toBe(SendRawTransaction.walletUnlocked)
          expect(options.client).toBe(client)
          expect(options.type).toBe('subChain')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('NavCoin', NavCoin)
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw('RAW_TRANSACTION')
    })
    it('should sign the raw transaction and call sendRaw', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.resolve('SIGNED_RAW_TRANSACTION') },
      }

      SendRawTransaction.runtime = {
        callback,
        client,
      }

      SendRawTransaction.sendRaw = (signedRaw) => {
        expect(signedRaw).toBe('SIGNED_RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw('RAW_TRANSACTION')
    })
  })
  describe('(walletUnlocked)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should fail to unlock the wallet', (done) => {
      SendRawTransaction.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data).toBe(undefined)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RAW_006')
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.walletUnlocked(false)
    })
    it('should unlock the wallet and call signRaw', (done) => {
      SendRawTransaction.runtime = {
        rawTrans: 'RAW_TRANSACTION',
      }

      SendRawTransaction.signRaw = (rawTrans) => {
        expect(rawTrans).toBe('RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.walletUnlocked(true, {})
    })
  })
  describe('(sendRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should fail to create the raw transaction', (done) => {
      SendRawTransaction.retry = (error) => {
        expect(error.code).toBe(-13)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_005')
        done()
      }

      SendRawTransaction.runtime = {
        client: {
          sendRawTransaction: () => { return Promise.reject({ code: -13 }) },
        }
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({ hex: '1234' })
    })
    it('should create the mock raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.rawOutcome).toBe('dummy-tx-id')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_TEST_001')
        done()
      }

      SendRawTransaction.runtime = {
        client: {
          sendRawTransaction: () => { return Promise.resolve('TXID') },
        },
        callback,
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const globalSettings = {
        serverType: 'INCOMING',
        preventSend: true,
      }
      SendRawTransaction.__set__('globalSettings', globalSettings)
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({ hex: '1234' })

    })
    it('should create the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.rawOutcome).toBe('TXID')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const client = {
        sendRawTransaction: () => { return Promise.resolve('TXID') },
      }

      SendRawTransaction.runtime = { client, callback }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({ hex: '1234' })
    })
  })
  describe('(retry)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should call create', (done) => {
      SendRawTransaction.create = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_007')
        done()
      }

      SendRawTransaction.runtime = {
        counter: 0,
        retryDelay: 100,
        callback: () => {}
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.retry({ code: -22 })
    })
    it('should max out retry attempts and run the callback', (done) => {
      SendRawTransaction.create = () => {
        SendRawTransaction.retry({ code: -22 })
      }

      SendRawTransaction.runtime = {
        counter: 0,
        retryDelay: 100,
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data).toEqual({ error: { code: -22 } })
          done()
        }
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.retry({ code: -22 })
    })
  })
})
