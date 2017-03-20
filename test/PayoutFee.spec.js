'use strict'

const expect = require('expect')
const rewire = require('rewire')
const config = require('config')
const sinon = require('sinon')


let PayoutFee = rewire('../src/lib/PayoutFee')
const incomingSettings = config.get('INCOMING')


beforeEach(() => {
  PayoutFee = rewire('../src/lib/PayoutFee')
})

describe('[PayoutFee]', () => {
  it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      PayoutFee.run({}, callback)
  })
  it('should call send() when params present', (done) => {
      const callback = (success, data) => {
      }

      PayoutFee.send = () => {
        expect(true).toBe(true)
        done()
      }
      PayoutFee.run({settings:"bloop",navClient:"wow"}, callback)
  })
  it('should fail when navBalance is less than poolAmount', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        getBalance: () => { return Promise.resolve(2) },
      }
      const mockSettings = {
        navPoolAmount: 10
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
  it('should call the callback when payoutfee.sent is false',(done) =>{
    const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.message).toBeA('string')
        done()
    }

    PayoutFee.runtime = {
        callback
    }
    PayoutFee.sent(true,{message:'testData'})
  })
  it('should fail when navPayout is less than the minimum specified amount', (done) => {
        const callback = (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          done()
        }
        const mockClient = {
          getBalance: () => { return Promise.resolve(12) },
        }
        const mockSettings = {
          navPoolAmount: 10,
          txFeePayoutMin: 200
        }
        PayoutFee.privateSettings = {
          txFee: 0.01
        }
        PayoutFee.runtime = {
          callback,
          settings: mockSettings,
          navClient: mockClient,
        }
        PayoutFee.send()
    })
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
        PayoutFee.sent(true,{test:'data'})
    })



})
