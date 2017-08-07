'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let SendRawTransaction = rewire('../src/lib/SendRawTransaction')

describe('[SendRawTransaction]', () => {
  describe('(run)', () => {
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
    it('should get the right params and fail to create the transaction without encrypted', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.error.code).toBe(-4)
        expect(SendRawTransaction.runtime).toEqual({})
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_003')
        done()
      }
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.reject({ code: -4 }) },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client }, callback)
    })
    it('should get the right params and fail to create the transaction with encrypted', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.error.code).toBe(-4)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_002')
        done()
      }
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.reject({ code: -4 }) },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client, encrypted: '1234' }, callback)
    })
    it('should get the right params and call signRaw (no encrypted)', (done) => {
      const callback = () => {}
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.resolve('RAW_TRANSACTION') },
      }

      SendRawTransaction.signRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.client).toBe(client)
        expect(options.rawTrans).toBe('RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client }, callback)
    })
    it('should get the right params and call signRaw (encrypted)', (done) => {
      const callback = () => {}
      const spentTransactions = []
      const outgoingTransactions = {}
      const client = {
        createRawTransaction: () => { return Promise.resolve('RAW_TRANSACTION') },
      }

      SendRawTransaction.signRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.client).toBe(client)
        expect(options.rawTrans).toBe('RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.createRaw({ spentTransactions, outgoingTransactions, client, encrypted: 'ENCRYPTED_DATA' }, callback)
    })
  })
  describe('(signRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      SendRawTransaction = rewire('../src/lib/SendRawTransaction')
    })
    it('should fail to sign the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.error.code).toBe(-23)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_004')
        done()
      }
      const client = {
        signRawTransaction: () => { return Promise.reject({ code: -23 }) },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw({
        rawTrans: 'RAW_TRANSACTION',
        client,
      }, callback)
    })
    it('should fail to sign the raw transaction and attempt to unlock the wallet (navCoin)', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.reject({ code: -13 }) },
        port: '44444',
      }

      SendRawTransaction.runtime = {}

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
      SendRawTransaction.signRaw({
        rawTrans: 'RAW_TRANSACTION',
        client,
      }, callback)
    })
    it('should fail to sign the raw transaction and attempt to unlock the wallet (subChain)', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.reject({ code: -13 }) },
        port: '33333',
      }

      SendRawTransaction.runtime = {}

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
      SendRawTransaction.signRaw({
        rawTrans: 'RAW_TRANSACTION',
        client,
      }, callback)
    })
    it('should sign the raw transaction and call sendRaw', (done) => {
      const callback = () => {}
      const client = {
        signRawTransaction: () => { return Promise.resolve('SIGNED_RAW_TRANSACTION') },
      }

      SendRawTransaction.runtime = {}

      SendRawTransaction.sendRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.client).toBe(client)
        expect(options.signedRaw).toBe('SIGNED_RAW_TRANSACTION')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.signRaw({
        rawTrans: 'RAW_TRANSACTION',
        client,
      }, callback)
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
        options: {
          callback: () => {},
          client: () => {},
          rawTrans: 'RAW_TRANSACTION',
        },
      }

      SendRawTransaction.signRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(SendRawTransaction.runtime.callback)
        expect(options.client).toBe(SendRawTransaction.runtime.options.client)
        expect(options.rawTrans).toBe('RAW_TRANSACTION')
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
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.error.code).toBe(-13)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_005')
        done()
      }
      const client = {
        sendRawTransaction: () => { return Promise.reject({ code: -13 }) },
      }

      SendRawTransaction.runtime = {}

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({
        signedRaw: { hex: '1234' },
        client,
      }, callback)
    })
    it('should create the mock raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.rawOutcome).toBe('dummy-tx-id')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RAW_TEST_001')
        done()
      }
      const client = {
        sendRawTransaction: () => { return Promise.resolve('TXID') },
      }

      SendRawTransaction.runtime = {}

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const globalSettings = {
        serverType: 'INCOMING',
        preventSend: true,
      }
      SendRawTransaction.__set__('globalSettings', globalSettings)
      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({
        signedRaw: { hex: '1234' },
        client,
      }, callback)
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

      SendRawTransaction.runtime = {}

      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendRawTransaction.__set__('Logger', mockLogger)
      SendRawTransaction.sendRaw({
        signedRaw: { hex: '1234' },
        client,
      }, callback)
    })
  })
})
