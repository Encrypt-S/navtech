'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

const privateSettings = require('../src/settings/private.settings.json')

let PayoutFee = rewire('../src/lib/PayoutFee')

beforeEach(() => {
  PayoutFee = rewire('../src/lib/PayoutFee')
})

describe('[PayoutFee]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      PayoutFee.run({}, callback)
    })
  })
  it('should call send() when params present', (done) => {
    const callback = () => {}

    PayoutFee.send = () => {
      expect(true).toBe(true)
      done()
    }
    PayoutFee.run({ settings: 'bloop', navClient: 'wow' }, callback)
  })
  describe('(send)', () => {
    it('should fail when navBalance is less than poolAmount', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        sinon.assert.calledWith(mockLogger.writeLog, 'PAY_002')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.resolve([{ amount: 100 }, { amount: 200 }, { amount: 500 }]) },
      }
      const mockSettings = {
        navPoolAmount: 1000,
      }
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PayoutFee.__set__('Logger', mockLogger)
      PayoutFee.send()
    })
    it('should fail when navPayout is less than the minimum specified amount', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(data.message).toBeA('string')
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.resolve([{ amount: 100 }, { amount: 200 }, { amount: 500 }]) },
      }
      const mockSettings = {
        navPoolAmount: 500,
        txFeePayoutMin: 500,
      }
      PayoutFee.privateSettings = {
        txFee: 0.01,
      }
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PayoutFee.__set__('Logger', mockLogger)
      PayoutFee.send()
    })
    it('should fail to get the current balance', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PAY_002A')
        done()
      }
      const mockClient = {
        name: 'jeeves',
        listUnspent: () => { return Promise.reject({ err: { code: -21 } }) },
      }
      const mockSettings = {
        navPoolAmount: 100,
        txFeePayoutMin: 1,
        anonTxFeeAddress: 'abc123',
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PayoutFee.__set__('Logger', mockLogger)
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      PayoutFee.send()
    })
    it('should run sendtoaddress if all conditions met', (done) => {
      const SendToAddress = {
        send: (options, callback) => {
          expect(options.client).toBe(mockClient)
          expect(options.address).toBe(mockSettings.anonTxFeeAddress)
          expect(options.amount).toBe(120 - 100 - privateSettings.txFee)
          expect(callback).toBe(PayoutFee.sent)
          done()
        },
      }
      const callback = () => {
        done()
      }
      const mockClient = {
        name: 'jeeves',
        listUnspent: () => { return Promise.resolve([{ amount: 100 }, { amount: 200 }, { amount: 500 }]) },
      }
      const mockSettings = {
        navPoolAmount: 500,
        txFeePayoutMin: 100,
        anonTxFeeAddress: 'abc123',
      }
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      PayoutFee.__set__('SendToAddress', SendToAddress)
      PayoutFee.send()
    })
  })
  it('should call the callback when payoutfee.sent is false', (done) => {
    const callback = (success, data) => {
      expect(success).toBe(true)
      expect(data.message).toBeA('string')
      done()
    }

    PayoutFee.runtime = {
      callback,
    }
    PayoutFee.sent(true, { message: 'testData' })
  })
  describe('(sent)', () => {
    it('sent should report back failure when payment did not succeed', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBe('failed to send fee payout')
        done()
      }
      const mockClient = {
        name: 'jeeves',
        getBalance: () => { return Promise.resolve(120) },
      }
      const mockSettings = {
        navPoolAmount: 10,
        txFeePayoutMin: 1,
        anonTxFeeAddress: 'abc123',
      }
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      PayoutFee.sent(false)
    })
    it('sent should report back success when payment succeeded', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data).toBeA('object')
        done()
      }
      const mockClient = {
        name: 'jeeves',
        getBalance: () => { return Promise.resolve(120) },
      }
      const mockSettings = {
        navPoolAmount: 10,
        txFeePayoutMin: 1,
        anonTxFeeAddress: 'abc123',
      }
      PayoutFee.runtime = {
        callback,
        settings: mockSettings,
        navClient: mockClient,
      }
      PayoutFee.sent(true, { test: 'data' })
    })
  })
})
