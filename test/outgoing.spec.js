'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('../config/example-outgoing.default')
const settings = config.OUTGOING

let OutgoingServer = rewire('../src/outgoing')

describe('[OutgoingServer]', () => {
  describe('(init)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should start the daemons and call findKeysToRemove', (done) => {
      const EncryptionKeys = {
        findKeysToRemove: (options, callback) => {
          expect(callback).toBe(OutgoingServer.startProcessing)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'OUT_000')
          expect(OutgoingServer.navClient).toBeA('object')
          expect(OutgoingServer.subClient).toBeA('object')
          done()
        },
      }
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('EncryptionKeys', EncryptionKeys)
      OutgoingServer.__set__('settings', settings)
      OutgoingServer.init()
    })
    it('should start the daemons and the timer', (done) => {
      const EncryptionKeys = {
        findKeysToRemove: () => {},
      }
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('EncryptionKeys', EncryptionKeys)
      OutgoingServer.__set__('settings', settings)
      OutgoingServer.init()
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_000')
      expect(OutgoingServer.navClient).toBeA('object')
      expect(OutgoingServer.subClient).toBeA('object')
      expect(OutgoingServer.cron._repeat).toBe(settings.scriptInterval)
      done()
    })
  })
  describe('(startProcessing)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should not proceed as the script is still processing', (done) => {
      OutgoingServer.processing = true
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.startProcessing()
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_002')
      done()
    })
    it('should proceed to run preflight checks', (done) => {
      OutgoingServer.navClient = { getInfo: () => true }
      OutgoingServer.subClient = { getInfo: () => true }
      const now = new Date()
      const clock = sinon.useFakeTimers(now.getTime())
      const PreFlight = {
        run: (options, callback) => {
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(options.subClient).toBe(OutgoingServer.subClient)
          expect(callback).toBe(OutgoingServer.preFlightComplete)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.runtime).toEqual({ cycleStart: now })
          clock.restore()
          done()
        },
      }
      OutgoingServer.processing = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('PreFlight', PreFlight)
      OutgoingServer.__set__('Date', Date)
      OutgoingServer.startProcessing()
    })
  })
  describe('(preFlightComplete)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should fail preflight and log error', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.preFlightComplete(false)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_003')
      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(false)
      done()
    })
    it('should pass preflight, set balances and call the refill function', (done) => {
      OutgoingServer.navClient = { listUnspent: () => true }
      OutgoingServer.subClient = { listUnspent: () => true }
      const PayoutFee = {
        run: (options, callback) => {
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(OutgoingServer.runtime).toEqual({
            navBalance: 1000,
            subBalance: 100,
          })
          done()
        },
      }
      OutgoingServer.processing = true
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('PayoutFee', PayoutFee)
      OutgoingServer.preFlightComplete(true, {
        navBalance: 1000,
        subBalance: 100,
      })
    })
  })
  describe('(currentBatchPrepared)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should fail to get the currentBatch with false success', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)

      OutgoingServer.currentBatchPrepared(false, {})

      sinon.assert.notCalled(mockLogger.writeLog)
      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(false)
      done()
    })
    it('should get the current batch, log failed sub and process', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const ProcessOutgoing = {
        run: (options, callback) => {
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(callback).toBe(OutgoingServer.transactionsProcessed)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          expect(OutgoingServer.runtime.failedSubTransactions).toEqual([1, 2, 3])
          expect(OutgoingServer.runtime.currentBatch).toEqual([4, 5, 6])
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('ProcessOutgoing', ProcessOutgoing)
      OutgoingServer.currentBatchPrepared(true, { failedSubTransactions: [1, 2, 3], currentBatch: [4, 5, 6] })
    })
    it('should get the current batch and process', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const ProcessOutgoing = {
        run: (options, callback) => {
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(callback).toBe(OutgoingServer.transactionsProcessed)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          expect(OutgoingServer.runtime.failedSubTransactions).toEqual(undefined)
          expect(OutgoingServer.runtime.currentBatch).toEqual([4, 5, 6])
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('ProcessOutgoing', ProcessOutgoing)
      OutgoingServer.currentBatchPrepared(true, { currentBatch: [4, 5, 6] })
    })
  })
  describe('(transactionsProcessed)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should fail to get the process transactions with false success', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)

      OutgoingServer.transactionsProcessed(false)

      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_004')
      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(true)
      done()
    })
    it('should get the current batch and log any failed', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const ReturnSubnav = {
        run: (options, callback) => {
          expect(options.subClient).toBe(OutgoingServer.subClient)
          expect(callback).toBe(OutgoingServer.subnavReturned)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'OUT_005A')
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('ReturnSubnav', ReturnSubnav)
      OutgoingServer.transactionsProcessed(true, { successfulTransactions: [1, 2, 3], failedTransactions: [4, 5, 6] })
    })
    it('should fail to send any transactions and pause', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      OutgoingServer.runtime = {}

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.transactionsProcessed(true, { successfulTransactions: [], failedTransactions: [4, 5, 6] })

      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(true)
      expect(OutgoingServer.runtime.successfulTransactions).toEqual(undefined)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_005')
      done()
    })
    it('should get the current batch and return the subnav', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const ReturnSubnav = {
        run: (options, callback) => {
          expect(options.subClient).toBe(OutgoingServer.subClient)
          expect(callback).toBe(OutgoingServer.subnavReturned)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          expect(OutgoingServer.runtime.successfulTransactions).toEqual([1, 2, 3])
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('ReturnSubnav', ReturnSubnav)
      OutgoingServer.transactionsProcessed(true, { successfulTransactions: [1, 2, 3] })
    })
  })
  describe('(feePaid)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should continue to return the subnav if it failed to pay the fee', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const mockClient = {
        getBalance: () => { return Promise.resolve(50000) },
      }

      const PrepareOutgoing = {
        run: (options, callback) => {
          expect(options.subClient).toBe(OutgoingServer.subClient)
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(callback).toBe(OutgoingServer.currentBatchPrepared)
          expect(options.navBalance).toBe(50000)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'OUT_006')
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('PrepareOutgoing', PrepareOutgoing)
      OutgoingServer.navClient = mockClient
      OutgoingServer.feePaid(false, { transaction: 123, error: 'failed' })
    })
    it('should continue to return the subnav if it paid the fee', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const mockClient = {
        getBalance: () => { return Promise.resolve(50000) },
      }

      const PrepareOutgoing = {
        run: (options, callback) => {
          expect(options.subClient).toBe(OutgoingServer.subClient)
          expect(options.navClient).toBe(OutgoingServer.navClient)
          expect(options.navBalance).toBe(50000)
          expect(callback).toBe(OutgoingServer.currentBatchPrepared)
          expect(OutgoingServer.processing).toBe(true)
          expect(OutgoingServer.paused).toBe(false)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.__set__('PrepareOutgoing', PrepareOutgoing)
      OutgoingServer.navClient = mockClient
      OutgoingServer.feePaid(true, { transaction: 123, error: 'failed' })
    })
    it('should stop if it couldnt get the balance after sending the fee', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false

      const mockClient = {
        getBalance: () => { return Promise.reject({ err: { code: -22 } }) },
      }

      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)
      OutgoingServer.navClient = mockClient
      OutgoingServer.feePaid(true, { transaction: 123, error: 'failed' })
      done()

    })
  })
  describe('(subnavReturned)', () => {
    beforeEach(() => { // reset the rewired functions
      OutgoingServer = rewire('../src/outgoing')
    })
    it('should fail to return the subnav and pause', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)

      OutgoingServer.subnavReturned(false)

      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'OUT_007')
      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(true)
      done()
    })
    it('should fail to return the subnav and end', (done) => {
      OutgoingServer.processing = true
      OutgoingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      OutgoingServer.__set__('Logger', mockLogger)

      OutgoingServer.subnavReturned(true)

      sinon.assert.notCalled(mockLogger.writeLog)
      expect(OutgoingServer.processing).toBe(false)
      expect(OutgoingServer.paused).toBe(false)
      done()
    })
  })
})
