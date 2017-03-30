'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let ReturnSubnav = rewire('../src/lib/ReturnSubnav')

describe('[ReturnSubnav]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RSN_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.run({ junkParam: 1234 }, callback)
    })
    it('should have the right params and call sendToIncoming', (done) => {
      const callback = () => {}
      const subClient = {}
      const settings = {}
      ReturnSubnav.sendToIncoming = () => {
        expect(ReturnSubnav.runtime.callback).toBe(callback)
        expect(ReturnSubnav.runtime.subClient).toBe(subClient)
        expect(ReturnSubnav.runtime.transactions).toEqual([1, 2, 3, 4])
        expect(ReturnSubnav.runtime.settings).toBe(settings)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.run({ transactions: [1, 2, 3, 4], settings, subClient }, callback)
    })
  })
  describe('(sendToIncoming)', () => {
    before(() => { // reset the rewired functions
      ReturnSubnav = rewire('../src/lib/ReturnSubnav')
    })
    it('should call the callback when theres no transactions left', (done) => {
      ReturnSubnav.runtime = {
        remainingTransactions: [],
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.message).toBeA('string')
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.sendToIncoming()
    })
    it('should have transactions to return so call the send function', (done) => {
      ReturnSubnav.runtime = {
        remainingTransactions: [{ transaction: 1 }, { transaction: 2 }],
        subClient: {},
      }
      const ReturnToSender = {
        send: (options, callback) => {
          expect(callback).toBe(ReturnSubnav.sent)
          expect(options.client).toBe(ReturnSubnav.runtime.subClient)
          expect(options.transaction).toEqual(1)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.__set__('ReturnToSender', ReturnToSender)
      ReturnSubnav.sendToIncoming()
    })
  })
  describe('(sent)', () => {
    before(() => { // reset the rewired functions
      ReturnSubnav = rewire('../src/lib/ReturnSubnav')
    })
    it('should fail because it couldnt return subnav (returned false)', (done) => {
      ReturnSubnav.runtime = {
        remainingTransactions: [1, 2, 3, 4],
      }
      ReturnSubnav.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSN_002')
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.sent(false)
    })
    it('should fail because it couldnt return subnav (no rawOutcome)', (done) => {
      ReturnSubnav.runtime = {
        remainingTransactions: [1, 2, 3, 4],
      }
      ReturnSubnav.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSN_002')
          done()
        },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.sent(true, { junkParam: '1234' })
    })
    it('should succeed and proceed to the next subnav transaction', (done) => {
      ReturnSubnav.runtime = {
        remainingTransactions: [1, 2, 3, 4],
      }
      ReturnSubnav.sendToIncoming = () => {
        expect(ReturnSubnav.runtime.remainingTransactions).toEqual([2, 3, 4])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      ReturnSubnav.__set__('Logger', mockLogger)
      ReturnSubnav.sent(true, { rawOutcome: '1234' })
    })
  })
})
