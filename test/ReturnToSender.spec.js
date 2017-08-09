'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let ReturnToSender = rewire('../src/lib/ReturnToSender')

describe('[ReturnSubnav]', () => {
  describe('(send)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RTS_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.send({ junkParam: 1234 }, callback)
    })
    it('should get the right params and fail to get the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RTS_002')
        done()
      }
      const client = {
        getRawTransaction: () => { return Promise.reject({ code: -17 }) },
      }
      const transaction = {
        txid: '1234',
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.send({ client, transaction }, callback)
    })
    it('should get the right params and get the raw transaction', (done) => {
      const callback = () => {}
      const incomingRaw = { txid: '1234' }
      const client = {
        getRawTransaction: () => { return Promise.resolve(incomingRaw) },
      }
      const transaction = {
        txid: '1234',
      }
      ReturnToSender.decodeOriginRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.transaction).toBe(transaction)
        expect(options.client).toBe(client)
        expect(options.incomingRaw).toBe(incomingRaw)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.send({ client, transaction }, callback)
    })
  })
  describe('(decodeOriginRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      ReturnToSender = rewire('../src/lib/ReturnToSender')
    })
    it('should fail to decode the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RTS_003')
        done()
      }
      const client = {
        decodeRawTransaction: () => { return Promise.reject({ code: -17 }) },
      }
      const transaction = {
        txid: '1234',
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.decodeOriginRaw({ client, transaction, incomingRaw: '1234' }, callback)
    })
    it('should decode the raw transaction', (done) => {
      const callback = () => {}
      const incomingTrans = { txid: '1234' }
      const client = {
        decodeRawTransaction: () => { return Promise.resolve(incomingTrans) },
      }
      const transaction = {
        txid: '1234',
      }
      ReturnToSender.getOriginRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.transaction).toBe(transaction)
        expect(options.client).toBe(client)
        expect(options.incomingTrans).toBe(incomingTrans)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.decodeOriginRaw({ client, transaction }, callback)
    })
  })
  describe('(decodeOriginRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      ReturnToSender = rewire('../src/lib/ReturnToSender')
    })
    it('should fail to decode the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RTS_004')
        done()
      }
      const client = {
        getRawTransaction: () => { return Promise.reject({ code: -17 }) },
      }
      const incomingTrans = {
        vin: [
          { txid: '1234' },
        ],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.getOriginRaw({ client, incomingTrans }, callback)
    })
    it('should decode the raw transaction', (done) => {
      const inputRaw = 'ASDF'
      const callback = () => {}
      const client = {
        getRawTransaction: () => { return Promise.resolve(inputRaw) },
      }
      const transaction = '1234'
      const incomingTrans = {
        vin: [
          { txid: '1234' },
        ],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.decodeOriginInputRaw = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.inputRaw).toBe(inputRaw)
        expect(options.client).toBe(client)
        expect(options.transaction).toBe(transaction)
        expect(options.incomingTrans).toBe(incomingTrans)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.getOriginRaw({ client, transaction, incomingTrans }, callback)
    })
  })
  describe('(decodeOriginInputRaw)', () => {
    beforeEach(() => { // reset the rewired functions
      ReturnToSender = rewire('../src/lib/ReturnToSender')
    })
    it('should fail to decode the raw transaction', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RTS_005')
        done()
      }
      const client = {
        decodeRawTransaction: () => { return Promise.reject({ code: -17 }) },
      }
      const inputRaw = 'ASDF'
      const incomingTrans = {
        vin: [
          { txid: '1234' },
        ],
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.decodeOriginInputRaw({ client, incomingTrans, inputRaw }, callback)
    })
    it('should decode the raw transaction', (done) => {
      const inputRaw = 'ASDF'
      const inputTrans = {
        vout: [{
          scriptPubKey: {
            addresses: ['ZXCV'],
          },
        }],
      }
      const callback = () => {}
      const client = {
        decodeRawTransaction: () => { return Promise.resolve(inputTrans) },
      }
      const transaction = '1234'
      const incomingTrans = {
        vin: [
          { txid: '1234', vout: 0 },
        ],
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnToSender.buildTransaction = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options.transaction).toBe(transaction)
        expect(options.client).toBe(client)
        expect(options.origin).toBe('ZXCV')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.decodeOriginInputRaw({ client, incomingTrans, inputRaw, transaction }, callback)
    })
  })
  describe('(buildTransaction)', () => {
    beforeEach(() => { // reset the rewired functions
      ReturnToSender = rewire('../src/lib/ReturnToSender')
    })
    it('should build the transaction and call createRaw', (done) => {
      const privateSettings = { txFee: 0.001 }
      const callback = () => {}
      const client = {}
      const transaction = {
        txid: '1234',
        vout: 0,
        amount: 100,
      }
      const origin = 'ZXCV'
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const SendRawTransaction = {
        createRaw: (options, parsedCallback) => {
          expect(parsedCallback).toBe(callback)
          expect(options.outgoingTransactions).toEqual({ ZXCV: 99.999 })
          expect(options.spentTransactions).toEqual([{ txid: '1234', vout: 0 }])
          expect(options.client).toBe(client)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.__set__('SendRawTransaction', SendRawTransaction)
      ReturnToSender.__set__('privateSettings', privateSettings)
      ReturnToSender.buildTransaction({ client, origin, transaction }, callback)
    })
    it('should build check the rounding is correct', (done) => {
      const privateSettings = { txFee: 0.001 }
      const callback = () => {}
      const client = {}
      const transaction = {
        txid: '1234',
        vout: 0,
        amount: 100.123456781111111,
      }
      const origin = 'ZXCV'
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const SendRawTransaction = {
        createRaw: (options, parsedCallback) => {
          expect(parsedCallback).toBe(callback)
          expect(options.outgoingTransactions).toEqual({ ZXCV: 100.12245678 })
          expect(options.spentTransactions).toEqual([{ txid: '1234', vout: 0 }])
          expect(options.client).toBe(client)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      ReturnToSender.__set__('Logger', mockLogger)
      ReturnToSender.__set__('SendRawTransaction', SendRawTransaction)
      ReturnToSender.__set__('privateSettings', privateSettings)
      ReturnToSender.buildTransaction({ client, origin, transaction }, callback)
    })
  })
})
