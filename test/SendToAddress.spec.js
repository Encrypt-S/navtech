'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let SendToAddress = rewire('../src/lib/SendToAddress')

describe('[SendToAddress]', () => {
  describe('(send)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'STA_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.send({ junkParam: 1234 }, callback)
    })
    it('should have the right params and reject due to maximum attempts', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.transaction).toBe(transaction)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'STA_002')
        done()
      }
      const client = {
        sendToAddress: () => { return Promise.reject({ code: -4 }) },
      }
      const address = 'ADDR'
      const amount = 10
      const transaction = { txid: '1234' }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.send({ address, amount, client, transaction, counter: 8 }, callback)
    })
    it('should have the right params and fail to send due to locked wallet', (done) => {
      const callback = () => {}
      const NavCoin = {
        unlockWallet: (options, parsedCallback) => {
          expect(parsedCallback).toBe(SendToAddress.walletUnlocked)
          expect(options.client).toBe(client)
          expect(options.type).toBe('navCoin')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const client = {
        sendToAddress: () => { return Promise.reject({ code: -13 }) },
        port: '44444',
      }
      const address = 'ADDR'
      const amount = 10
      const transaction = { txid: '1234' }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendToAddress.__set__('NavCoin', NavCoin)
      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.send({ address, amount, client, transaction, counter: 1 }, callback)
    })
    it('should have the right params and succeed', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.transaction).toBe(transaction)
        expect(data.sendOutcome).toBe('TXID')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const client = {
        sendToAddress: () => { return Promise.resolve('TXID') },
        port: '44444',
      }
      const address = 'ADDR'
      const amount = 10
      const transaction = { txid: '1234' }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.send({ address, amount, client, transaction, counter: 1 }, callback)
    })
    it('should have the right params and successfully round the transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.transaction).toBe(transaction)
        expect(data.sendOutcome.amount).toBe(100.12345678)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const client = {
        sendToAddress: (address, amount) => { return Promise.resolve({ amount }) },
        port: '44444',
      }
      const address = 'ADDR'
      const amount = 100.123456781111111
      const transaction = { txid: '1234' }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.send({ address, amount, client, transaction, counter: 1 }, callback)
    })
  })
  describe('(walletUnlocked)', () => {
    before(() => { // reset the rewired functions
      SendToAddress = rewire('../src/lib/SendToAddress')
    })
    it('should fail to unlock the wallet', (done) => {
      SendToAddress.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.transaction).toEqual({ txid: '1234' })
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'STA_004')
          done()
        },
        options: {
          transaction: { txid: '1234' },
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.walletUnlocked(false)
    })
    it('should unlock the wallet and call send again', (done) => {
      SendToAddress.runtime = {
        callback: () => {},
        options: {
          client: {},
          transaction: { txid: '1234' },
          address: 'ASDF',
          amount: 10,
          encrypted: 'ENCRYPTED_DATA',
          counter: 0,
        },
      }
      SendToAddress.send = (options, parsedCallback) => {
        expect(parsedCallback).toBe(SendToAddress.runtime.callback)
        expect(options.client).toBe(SendToAddress.runtime.options.client)
        expect(options.address).toBe('ASDF')
        expect(options.amount).toBe(10)
        expect(options.transaction).toEqual({ txid: '1234' })
        expect(options.encrypted).toBe('ENCRYPTED_DATA')
        expect(options.counter).toBe(0)
        expect(options.triedToUnlock).toBe(true)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      SendToAddress.__set__('Logger', mockLogger)
      SendToAddress.walletUnlocked(true, {})
    })
  })
})
