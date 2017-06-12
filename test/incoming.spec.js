'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')
const settings = config.get('INCOMING')

let IncomingServer = rewire('../src/incoming')

describe('[IncomingServer]', () => {
  describe('(init)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should start the daemons and call findKeysToRemove', (done) => {
      const EncryptionKeys = {
        findKeysToRemove: (options, callback) => {
          expect(callback).toBe(IncomingServer.startProcessing)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_000')
          expect(IncomingServer.navClient).toBeA('object')
          expect(IncomingServer.subClient).toBeA('object')
          done()
        },
      }
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('EncryptionKeys', EncryptionKeys)
      IncomingServer.init()
    })
    it('should start the daemons and the timer', (done) => {
      const EncryptionKeys = {
        findKeysToRemove: () => {},
      }
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('EncryptionKeys', EncryptionKeys)
      IncomingServer.init()
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_000')
      expect(IncomingServer.navClient).toBeA('object')
      expect(IncomingServer.subClient).toBeA('object')
      expect(IncomingServer.cron._repeat).toBe(settings.scriptInterval)
      done()
    })
  })
  describe('(startProcessing)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should not proceed as the script is still processing', (done) => {
      IncomingServer.processing = true
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.startProcessing()
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_002')
      done()
    })
    it('should proceed to run preflight checks', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const now = new Date()
      const clock = sinon.useFakeTimers(now.getTime())
      const PreFlight = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(options.subClient).toBe(IncomingServer.subClient)
          expect(callback).toBe(IncomingServer.preFlightComplete)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.runtime).toEqual({ cycleStart: now })
          clock.restore()
          done()
        },
      }
      IncomingServer.processing = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('PreFlight', PreFlight)
      IncomingServer.__set__('Date', Date)
      IncomingServer.startProcessing()
    })
  })
  describe('(preFlightComplete)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail preflight and log error', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.preFlightComplete(false)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_003')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(false)
      done()
    })
    it('should pass preflight, set balances and call the refill function', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const RefillOutgoing = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.holdingProcessed)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.runtime).toEqual({
            navBalance: 1000,
            subBalance: 100,
          })
          done()
        },
      }
      IncomingServer.processing = true
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('RefillOutgoing', RefillOutgoing)
      IncomingServer.preFlightComplete(true, {
        navBalance: 1000,
        subBalance: 100,
      })
    })
  })
  describe('(holdingProcessed)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to process holding transactions', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.holdingProcessed(false)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_004')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(true)
      done()
    })
    it('should process the holding, set balances and call the refill function', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const SelectOutgoing = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(options.settings).toBe(settings)
          expect(callback).toBe(IncomingServer.outgoingSelected)
          expect(IncomingServer.processing).toBe(true)
          done()
        },
      }
      IncomingServer.processing = true
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('SelectOutgoing', SelectOutgoing)
      IncomingServer.holdingProcessed(true, {
        navClient: IncomingServer.navClient,
        settings,
      })
    })
  })
  describe('(outgoingSelected)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to select outgoing server', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.outgoingSelected(false)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_005')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(false)
      done()
    })
    it('should return all to senders if failed to locate outgoing server', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          expect(IncomingServer.processing).toBe(true)
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.outgoingSelected(true, {
        returnAllToSenders: true,
      })
    })
    it('should pause transactions if the issue was on the incoming server', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(true)
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.outgoingSelected(true, {
        returnAllToSenders: true,
        pause: true,
      })
    })
    it('should not pause transactions if the issue was on the outgoing server', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.outgoingSelected(true, {
        returnAllToSenders: true,
      })
    })
    it('should run prepareIncoming if all params correct', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.subClient = { getInfo: () => true }
      const PrepareIncoming = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(options.outgoingNavBalance).toBe(1000)
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.currentBatchPrepared)
          expect(options.settings).toBe(settings)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.runtime).toEqual({
            chosenOutgoing: 'QWER',
            outgoingNavBalance: 1000,
            holdingEncrypted: 'ZXCV',
            outgoingPubKey: 'ASDF',
          })
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('PrepareIncoming', PrepareIncoming)
      IncomingServer.outgoingSelected(true, {
        returnAllToSenders: false,
        chosenOutgoing: 'QWER',
        outgoingNavBalance: 1000,
        holdingEncrypted: 'ZXCV',
        outgoingPubKey: 'ASDF',
      })
    })
  })
  describe('(allPendingReturned)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to return all pending and pause', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.allPendingReturned(false)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_006')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(true)
      done()
    })
    it('should return the pending to sender and reset', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.allPendingReturned(true)

      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_007')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.processing).toBe(false)
      done()
    })
  })
  describe('(currentBatchPrepared)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to get the currentBatch with false success', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.currentBatchPrepared(false)

      sinon.assert.notCalled(mockLogger.writeLog)
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(false)
      done()
    })
    it('should fail to get the currentBatch with bad params', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.currentBatchPrepared(true, {
        junkParam: true,
      })

      sinon.assert.notCalled(mockLogger.writeLog)
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(false)
      done()
    })
    it('should get the currentBatch but have some to return', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      const ReturnAllToSenders = {
        fromList: (options, callback) => {
          expect(callback).toBe(IncomingServer.pendingFailedReturned)
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(options.transactionsToReturn).toEqual([{ txid: '1234', amount: 100 }, { txid: 'QWER', amount: 100 }])
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)

      IncomingServer.currentBatchPrepared(true, {
        currentBatch: {},
        currentFlattened: {},
        numFlattened: {},
        pendingToReturn: [{ txid: '1234', amount: 100 }, { txid: 'QWER', amount: 100 }],
      })
    })
    it('should get the currentBatch and have none to return', (done) => {
      IncomingServer.subClient = { getInfo: () => true }
      IncomingServer.runtime = {
        chosenOutgoing: {
          ipAddress: '10.10.10.1',
        },
      }
      const RetrieveSubchainAddresses = {
        run: (options, callback) => {
          expect(callback).toBe(IncomingServer.retrievedSubchainAddresses)
          expect(options.subClient).toBe(IncomingServer.subClient)
          expect(options.numAddresses).toBe(5)
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('RetrieveSubchainAddresses', RetrieveSubchainAddresses)

      IncomingServer.currentBatchPrepared(true, {
        currentBatch: { ABC: { unique: 'ABC', amount: 30 }, XYZ: { unique: 'XYZ', amount: 200 } },
        currentFlattened: { ABC: [10, 10, 10], XYZ: [100, 100] },
        numFlattened: 5,
        pendingToReturn: [],
      })
    })
  })
  describe('(pendingFailedReturned)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to return the pending that are marked as expired', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false

      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_011A')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(true)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.pendingFailedReturned(false)
    })
    it('should have returned all expired to sender and get the subchain addresses', done => {
      IncomingServer.subClient = { getInfo: () => true }
      IncomingServer.runtime = {
        chosenOutgoing: {
          ipAddress: '10.10.10.1',
        },
        numFlattened: 5,
      }
      const RetrieveSubchainAddresses = {
        run: (options, callback) => {
          expect(callback).toBe(IncomingServer.retrievedSubchainAddresses)
          expect(options.subClient).toBe(IncomingServer.subClient)
          expect(options.numAddresses).toBe(5)
          done()
        },
      }
      IncomingServer.processing = true
      IncomingServer.paused = false
      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('RetrieveSubchainAddresses', RetrieveSubchainAddresses)

      IncomingServer.pendingFailedReturned(true, {})
    })
  })
  describe('(retrievedSubchainAddresses)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to retrieve subchain addresses with success false', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false

      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_009')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.retrievedSubchainAddresses(false)
    })
    it('should fail to retrieve subchain addresses with bad params', (done) => {
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.processing = true
      IncomingServer.paused = false

      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_009')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.retrievedSubchainAddresses(true, { junkParam: true })
    })
    it('should have everything it needs to process the batch', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.subClient = { getInfo: () => true }
      IncomingServer.navClient = { getInfo: () => true }
      IncomingServer.runtime = {
        currentBatch: { ABC: { unique: 'ABC', amount: 30 }, XYZ: { unique: 'XYZ', amount: 200 } },
        currentFlattened: { ABC: [10, 10, 10], XYZ: [100, 100] },
        outgoingPubKey: 'ZXCV',
      }
      const ProcessIncoming = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(options.subClient).toBe(IncomingServer.subClient)
          expect(options.currentBatch).toEqual(IncomingServer.runtime.currentBatch)
          expect(options.currentFlattened).toEqual(IncomingServer.runtime.currentFlattened)
          expect(options.outgoingPubKey).toBe('ZXCV')
          expect(options.subAddresses).toEqual(['QWER', 'ASDF', 'ZXCV'])
          expect(options.settings).toBe(settings)
          expect(callback).toBe(IncomingServer.transactionsProcessed)
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ProcessIncoming', ProcessIncoming)
      IncomingServer.retrievedSubchainAddresses(true, { subAddresses: ['QWER', 'ASDF', 'ZXCV'] })
    })
  })
  describe('(transactionsProcessed)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to process all transactions and return all to senders', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      const ReturnAllToSenders = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.allPendingReturned)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_010')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(true)
          done()
        },
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.transactionsProcessed(false)
    })
    it('should process some and fail a partial send', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.transactionsProcessed(false, { partialFailure: true })

      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_010A')
      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(true)
      done()
    })
    it('should succeed with some failed and return the failed', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      const ReturnAllToSenders = {
        fromList: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.failedTransactionsReturned)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_011')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          expect(options.transactionsToReturn).toEqual([
            { txid: 'QQQQ' }, { txid: 'WWWW' }, { txid: 'EEEE' },
            { txid: 'AAAA' }, { txid: 'SSSS' }, { txid: 'DDDD' },
          ])
          done()
        },
      }

      const successfulTxGroups = [
        {
          unique: 'QWER',
          transactions: [{ txid: '1111' }, { txid: '2222' }, { txid: '3333' }],
        },
        {
          unique: 'ASDF',
          transactions: [{ txid: '4444' }, { txid: '5555' }, { txid: '6666' }],
        },
        {
          unique: 'ZXCV',
          transactions: [{ txid: '7777' }, { txid: '8888' }, { txid: '9999' }],
        },
      ]

      const txGroupsToReturn = [
        {
          unique: '1234',
          transactions: [{ txid: 'QQQQ' }, { txid: 'WWWW' }, { txid: 'EEEE' }],
        },
        {
          unique: '6789',
          transactions: [{ txid: 'AAAA' }, { txid: 'SSSS' }, { txid: 'DDDD' }],
        },
      ]

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('ReturnAllToSenders', ReturnAllToSenders)
      IncomingServer.transactionsProcessed(true, { successfulTxGroups, txGroupsToReturn })
    })
    it('should succeed with no failed and skip trying to return any', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      IncomingServer.failedTransactionsReturned = (success) => {
        expect(success).toBe(true)
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(IncomingServer.processing).toBe(true)
        expect(IncomingServer.paused).toBe(false)
        expect(IncomingServer.runtime.successfulTxGroups).toEqual(successfulTxGroups)
        done()
      }

      const successfulTxGroups = [
        {
          unique: 'QWER',
          transactions: [{ txid: '1111' }, { txid: '2222' }, { txid: '3333' }],
        },
        {
          unique: 'ASDF',
          transactions: [{ txid: '4444' }, { txid: '5555' }, { txid: '6666' }],
        },
        {
          unique: 'ZXCV',
          transactions: [{ txid: '7777' }, { txid: '8888' }, { txid: '9999' }],
        },
      ]

      const txGroupsToReturn = []

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.transactionsProcessed(true, { successfulTxGroups, txGroupsToReturn })
    })
  })
  describe('(failedTransactionsReturned)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to return the failed to sender and continue to try to spend to holding', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      const successfulTxGroups = [
        {
          unique: 'QWER',
          transactions: [{ txid: '1111' }, { txid: '2222' }, { txid: '3333' }],
        },
        {
          unique: 'ASDF',
          transactions: [{ txid: '4444' }, { txid: '5555' }, { txid: '6666' }],
        },
        {
          unique: 'ZXCV',
          transactions: [{ txid: '7777' }, { txid: '8888' }, { txid: '9999' }],
        },
      ]

      const SpendToHolding = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.spentToHolding)
          expect(options.holdingEncrypted).toBe('QWER==')
          expect(options.successfulSubTransactions).toEqual([
            { txid: '1111' }, { txid: '2222' }, { txid: '3333' },
            { txid: '4444' }, { txid: '5555' }, { txid: '6666' },
            { txid: '7777' }, { txid: '8888' }, { txid: '9999' },
          ])
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'INC_012')
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(true)
          done()
        },
      }

      IncomingServer.runtime = {
        successfulTxGroups,
        holdingEncrypted: 'QWER==',
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('SpendToHolding', SpendToHolding)
      IncomingServer.failedTransactionsReturned(false)
    })
    it('should return the failed to sender and continue to spend to holding', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false
      IncomingServer.navClient = { getInfo: () => true }

      const successfulTxGroups = [
        {
          unique: 'QWER',
          transactions: [{ txid: '1111' }, { txid: '2222' }, { txid: '3333' }],
        },
        {
          unique: 'ASDF',
          transactions: [{ txid: '4444' }, { txid: '5555' }, { txid: '6666' }],
        },
        {
          unique: 'ZXCV',
          transactions: [{ txid: '7777' }, { txid: '8888' }, { txid: '9999' }],
        },
      ]

      const SpendToHolding = {
        run: (options, callback) => {
          expect(options.navClient).toBe(IncomingServer.navClient)
          expect(callback).toBe(IncomingServer.spentToHolding)
          expect(options.holdingEncrypted).toBe('QWER==')
          expect(options.successfulSubTransactions).toEqual([
            { txid: '1111' }, { txid: '2222' }, { txid: '3333' },
            { txid: '4444' }, { txid: '5555' }, { txid: '6666' },
            { txid: '7777' }, { txid: '8888' }, { txid: '9999' },
          ])
          sinon.assert.notCalled(mockLogger.writeLog)
          expect(IncomingServer.processing).toBe(true)
          expect(IncomingServer.paused).toBe(false)
          done()
        },
      }

      IncomingServer.runtime = {
        successfulTxGroups,
        holdingEncrypted: 'QWER==',
      }

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)
      IncomingServer.__set__('SpendToHolding', SpendToHolding)
      IncomingServer.failedTransactionsReturned(true)
    })
  })
  describe('(spentToHolding)', () => {
    before(() => { // reset the rewired functions
      IncomingServer = rewire('../src/incoming')
    })
    it('should fail to spend the processed to holding and pause', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.spentToHolding(false)

      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(true)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'INC_013')
      done()
    })
    it('should fail to spend the processed to holding and pause', (done) => {
      IncomingServer.processing = true
      IncomingServer.paused = false

      const mockLogger = { writeLog: sinon.spy() }
      IncomingServer.__set__('Logger', mockLogger)

      IncomingServer.spentToHolding(true)

      expect(IncomingServer.processing).toBe(false)
      expect(IncomingServer.paused).toBe(false)
      sinon.assert.notCalled(mockLogger.writeLog)
      done()
    })
  })
})
