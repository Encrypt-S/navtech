'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let SpendToHolding = rewire('../src/lib/SpendToHolding')

describe('[SpendToHolding]', () => {
  describe('(send)', () => {
    beforeEach(() => { // reset the rewired functions
      SpendToHolding = rewire('../src/lib/SpendToHolding')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'STH_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.run({ junkParam: 1234 }, callback)
    })
    it('should have correct params and call getRandomAccountAddresses', (done) => {
      const callback = () => {}
      const navClient = {
        getInfo: () => {},
      }
      const successfulSubTransactions = [1, 2, 3]
      const holdingEncrypted = 'QWER=='
      const RandomizeTransactions = {
        getRandomAccountAddresses: (options, parsedCallback) => {
          expect(parsedCallback).toBe(SpendToHolding.createHoldingTransactions)
          expect(options.accountName).toBe('HOLDING_ACCOUNT')
          expect(options.client).toBe(navClient)
          expect(options.numAddresses).toBe(1)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const privateSettings = {
        account: { HOLDING: 'HOLDING_ACCOUNT' },
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.__set__('RandomizeTransactions', RandomizeTransactions)
      SpendToHolding.__set__('privateSettings', privateSettings)
      SpendToHolding.run({ navClient, successfulSubTransactions, holdingEncrypted }, callback)
    })
  })
  describe('(createHoldingTransactions)', () => {
    beforeEach(() => { // reset the rewired functions
      SpendToHolding = rewire('../src/lib/SpendToHolding')
    })
    it('should fail to get the random holding address', (done) => {
      SpendToHolding.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'STH_002')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.createHoldingTransactions(false)
    })
    it('should build the holding transactions and create call createRaw', (done) => {
      const navClient = {
        getInfo: () => {},
      }
      const privateSettings = {
        txFee: 0.0001,
      }
      SpendToHolding.runtime = {
        successfulSubTransactions: [
          { txid: '1234', amount: 100, vout: 0 },
          { txid: '2345', amount: 200, vout: 1 },
          { txid: '6789', amount: 400, vout: 2 },
        ],
        holdingEncrypted: 'QWER==',
        navClient,
      }
      const SendRawTransaction = {
        createRaw: (options, parsedCallback) => {
          expect(options.outgoingTransactions).toEqual({
            ZXCVB: 700 - 0.0003,
          })
          expect(options.spentTransactions).toEqual([
            { txid: '1234', vout: 0 },
            { txid: '2345', vout: 1 },
            { txid: '6789', vout: 2 },
          ])
          expect(options.encrypted).toBe('QWER==')
          expect(options.client).toBe(navClient)
          expect(parsedCallback).toBe(SpendToHolding.sentToHolding)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.__set__('privateSettings', privateSettings)
      SpendToHolding.__set__('SendRawTransaction', SendRawTransaction)
      SpendToHolding.createHoldingTransactions(true, { pickedAddresses: ['ZXCVB'] })
    })
  })
  describe('(sentToHolding)', () => {
    beforeEach(() => { // reset the rewired functions
      SpendToHolding = rewire('../src/lib/SpendToHolding')
    })
    it('should fail to spend to holding', (done) => {
      SpendToHolding.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'STH_003')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.sentToHolding(false)
    })
    it('should successfully spend to holding', (done) => {
      SpendToHolding.runtime = {
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data).toEqual({ txid: '1234' })
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SpendToHolding.__set__('Logger', mockLogger)
      SpendToHolding.sentToHolding(true, { txid: '1234' })
    })
  })
})
