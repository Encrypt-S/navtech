'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../src/settings/private.settings.json')

let PrepareIncoming = rewire('../src/lib/PrepareIncoming')

describe('[PrepareIncoming]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.run({ junkParam: 1234 }, callback)
    })
    it('should set the runtime variables and call getUnspent', (done) => {
      PrepareIncoming.getUnspent = () => {
        expect(PrepareIncoming.runtime.callback).toBe(callback)
        expect(PrepareIncoming.runtime.navClient).toBe(mockClient)
        expect(PrepareIncoming.runtime.outgoingNavBalance).toBe(50000)
        expect(PrepareIncoming.runtime.subBalance).toBe(1000)
        done()
      }

      const callback = () => {}

      const mockClient = {
        getAccountAddress: () => { return Promise.reject({ code: -17 }) },
      }

      PrepareIncoming.run({
        navClient: mockClient,
        outgoingNavBalance: 50000,
        subBalance: 1000,
        settings: { test: true },
      }, callback)
    })
  })
  describe('(getUnspent)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should fail to list unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.getUnspent()
    })
    it('should find no unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.resolve([]) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.getUnspent()
    })
    it('should find unspent and call the filter function', (done) => {
      const mockNavCoin = {
        filterUnspent: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PrepareIncoming.unspentFiltered)
          expect(options.unspent).toBe(unspent)
          expect(options.client).toBe(mockClient)
          expect(options.accountName).toBe(privateSettings.account[globalSettings.serverType])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const unspent = [1, 2, 3, 4]
      const callback = () => {}
      const mockClient = {
        listUnspent: () => { return Promise.resolve(unspent) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('NavCoin', mockNavCoin)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.getUnspent()
    })
  })
  describe('(unspentFiltered)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should fail to filter the unspent', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.unspentFiltered(false)
    })
    it('should return true but have incorrect params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.unspentFiltered(true, {
        junkParam: 1234,
      })
    })
    it('should return true but have no filtered pending', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        callback,
      }
      PrepareIncoming.unspentFiltered(true, {
        currentPending: [],
      })
    })
    it('should return the right data, set currentPending and call GroupPartials.run', (done) => {
      const GroupPartials = {
        run: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PrepareIncoming.partialsGrouped)
          expect(options.currentPending).toBe(currentPending)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockClient = {
        listUnspent: () => { return Promise.reject({ code: -17 }) },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('GroupPartials', GroupPartials)
      PrepareIncoming.runtime = {
        navClient: mockClient,
        subBalance: 1000,
        outgoingNavBalance: 50000,
      }
      const currentPending = [1, 2, 3, 4]
      PrepareIncoming.unspentFiltered(true, {
        currentPending,
      })
    })
  })
  describe('(partialsGrouped)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should fail on success', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003A')
        done()
      }
      PrepareIncoming.runtime = {
        callback,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.partialsGrouped(false, {
        junkParam: 1234,
      })
    })
    it('should fail on data', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003A')
        done()
      }
      PrepareIncoming.runtime = {
        callback,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.partialsGrouped(true)
    })
    it('should fail with incorrect data and return null pendingToReturn object', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003AA')
        expect(data.pendingToReturn).toBe(null)
        done()
      }
      PrepareIncoming.runtime = {
        callback,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.partialsGrouped(true, {
        junkParam: 1234,
      })
    })
    it('should fail with no readyToProcess and return a valid pendingToReturn object', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003AA')
        expect(data.pendingToReturn).toEqual({ 1234: { unique: '1234' }, 2345: { unique: '2345' } })
        done()
      }
      PrepareIncoming.runtime = {
        callback,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.partialsGrouped(true, {
        transactionsToReturn: { 1234: { unique: '1234' }, 2345: { unique: '2345' } },
      })
    })
    it('should set the pendingToReturn object to runtime and call pruneUnspent', (done) => {
      PrepareIncoming.pruneUnspent = (options, callback) => {
        expect(options.readyToProcess).toEqual({ 1234: { unique: '1234' }, 2345: { unique: '2345' } })
        expect(options.client).toBe(3456)
        expect(options.subBalance).toBe(1000)
        expect(options.maxAmount).toBe(10000)
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(callback).toBe(PrepareIncoming.unspentPruned)
        done()
      }
      PrepareIncoming.runtime = {
        currentPending: 1234,
        navClient: 3456,
        subBalance: 1000,
        outgoingNavBalance: 10000,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.partialsGrouped(true, {
        readyToProcess: { 1234: { unique: '1234' }, 2345: { unique: '2345' } },
      })
    })
  })
  describe('(pruneUnspent)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should fail on subBalance is not float', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003B')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.runtime = {
        transactionsToReturn: 1234,
      }
      const currentPending = [1, 2, 3, 4]
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        currentPending,
        subBalance: true,
      }, callback)
    })
    it('should fail on maxAmount is not float', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003B')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const currentPending = [1, 2, 3, 4]
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        currentPending,
        subBalance: 1000,
        maxAmount: 'ABCDE',
      }, callback)
    })
    it('should fail on no readyToProcess', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_003B')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const currentPending = [1, 2, 3, 4]
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        currentPending,
        subBalance: 1000,
        maxAmount: 10000,
      }, callback)
    })
    it('should fail to return any pruned', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.message).toBeA('string')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const currentPending = [
        { txid: 'ASDF', amount: 1000 },
        { txid: 'QWER', amount: 3000 },
        { txid: 'ZXCV', amount: 2000 },
      ]
      const readyToProcess = {
        111: {
          amount: 5000,
          unique: '111',
          transactions: {
            ASDF: { txid: 'ASDF', amount: 1000 },
            QWER: { txid: 'QWER', amount: 3000 },
            ZXCV: { txid: 'ZXCV', amount: 2000 },
          },
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        currentPending,
        subBalance: 1000,
        maxAmount: 4000,
        readyToProcess,
      }, callback)
    })
    it('should have 1 group ready after pruning', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.currentBatch).toEqual([
          {
            amount: 1000,
            unique: '111',
            transactions: {
              REWQ: { txid: 'REWQ', amount: 500 },
              FDSA: { txid: 'FDSA', amount: 200 },
              VCXZ: { txid: 'VCXZ', amount: 300 },
            },
          },
        ])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const currentPending = [
        { txid: 'ASDF', amount: 1000 },
        { txid: 'QWER', amount: 3000 },
        { txid: 'ZXCV', amount: 2000 },
        { txid: 'REWQ', amount: 500 },
        { txid: 'FDSA', amount: 200 },
        { txid: 'VCXZ', amount: 300 },
      ]
      const readyToProcess = {
        111: {
          amount: 1000,
          unique: '111',
          transactions: {
            REWQ: { txid: 'REWQ', amount: 500 },
            FDSA: { txid: 'FDSA', amount: 200 },
            VCXZ: { txid: 'VCXZ', amount: 300 },
          },
        },
        222: {
          amount: 5000,
          unique: '2222',
          transactions: {
            ASDF: { txid: 'ASDF', amount: 1000 },
            QWER: { txid: 'QWER', amount: 3000 },
            ZXCV: { txid: 'ZXCV', amount: 2000 },
          },
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        currentPending,
        subBalance: 1000,
        maxAmount: 5000,
        readyToProcess,
      }, callback)
    })
    it('should have multiple groups ready after pruning', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.currentBatch).toEqual([
          {
            amount: 1000,
            unique: '111',
            transactions: {
              REWQ: { txid: 'REWQ', amount: 500 },
              FDSA: { txid: 'FDSA', amount: 200 },
              VCXZ: { txid: 'VCXZ', amount: 300 },
            },
          },
          {
            amount: 1000,
            unique: '222',
            transactions: {
              REWQ: { txid: 'REWQ', amount: 500 },
              FDSA: { txid: 'FDSA', amount: 200 },
              VCXZ: { txid: 'VCXZ', amount: 300 },
            },
          },
        ])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const readyToProcess = {
        111: {
          amount: 1000,
          unique: '111',
          transactions: {
            REWQ: { txid: 'REWQ', amount: 500 },
            FDSA: { txid: 'FDSA', amount: 200 },
            VCXZ: { txid: 'VCXZ', amount: 300 },
          },
        },
        222: {
          amount: 1000,
          unique: '222',
          transactions: {
            REWQ: { txid: 'REWQ', amount: 500 },
            FDSA: { txid: 'FDSA', amount: 200 },
            VCXZ: { txid: 'VCXZ', amount: 300 },
          },
        },
        333: {
          amount: 5000,
          unique: '333',
          transactions: {
            ASDF: { txid: 'ASDF', amount: 1000 },
            QWER: { txid: 'QWER', amount: 3000 },
            ZXCV: { txid: 'ZXCV', amount: 2000 },
          },
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.pruneUnspent({
        subBalance: 1000,
        maxAmount: 5000,
        readyToProcess,
      }, callback)
    })
  })
  describe('(unspentPruned)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should have pendingToReturn', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.pendingToReturn).toEqual(1234)
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
        transactionsToReturn: 1234,
      }
      PrepareIncoming.unspentPruned(
        false, {})
    })
    it('should fail with no current batch and no transactions to return', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.pendingToReturn).toEqual(null)
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PrepareIncoming.unspentPruned(
        true, {})
    })
    it('should fail with empty current batch', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.pendingToReturn).toEqual(null)
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PrepareIncoming.unspentPruned(
        true, { currentBatch: [] })
    })
    it('should succeed to prune the current batch and run FlattenTransactions.incoming', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockFlattenTransactions = {
        incoming: (options, callback) => {
          expect(options.amountToFlatten).toBe(100)
          expect(options.anonFeePercent).toBe(0.5)
          expect(callback).toBe(PrepareIncoming.flattened)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      PrepareIncoming.runtime = {
        settings: {
          anonFeePercent: 0.5,
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('FlattenTransactions', mockFlattenTransactions)
      const currentBatch = [
        { amount: 100 },
        { amount: 500 },
      ]
      PrepareIncoming.unspentPruned(
        true, { currentBatch })
    })
  })
  describe('(flattened)', () => {
    beforeEach(() => { // reset the rewired functions
      PrepareIncoming = rewire('../src/lib/PrepareIncoming')
    })
    it('should fail with false success', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockFlattenTransactions = {
        incoming: (options, callback) => {
          expect(options.amountToFlatten).toBe(542)
          expect(callback).toBe(PrepareIncoming.flattened)
          expect(PrepareIncoming.runtime.remainingToFlatten).toEqual([{ unique: 'ASD', amount: 542, transactions: {} }])
          expect(PrepareIncoming.runtime.numFlattened).toBe(10)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_004')
          done()
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('FlattenTransactions', mockFlattenTransactions)
      PrepareIncoming.runtime = {
        remainingToFlatten: [
          { unique: 'QWE', amount: 231, transactions: {} },
          { unique: 'ASD', amount: 542, transactions: {} },
        ],
        numFlattened: 10,
        currentFlattened: {},
        transactionsToReturn: null,
        settings: {
          anonFeePercent: 0.5,
        },
      }
      PrepareIncoming.flattened(false, {})
    })
    it('should fail with false success', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockFlattenTransactions = {
        incoming: (options, callback) => {
          expect(options.amountToFlatten).toBe(542)
          expect(callback).toBe(PrepareIncoming.flattened)
          expect(PrepareIncoming.runtime.remainingToFlatten).toEqual([{ unique: 'ASD', amount: 542, transactions: {} }])
          expect(PrepareIncoming.runtime.numFlattened).toBe(10)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PREPI_004')
          done()
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('FlattenTransactions', mockFlattenTransactions)
      PrepareIncoming.runtime = {
        remainingToFlatten: [
          { unique: 'QWE', amount: 231, transactions: {} },
          { unique: 'ASD', amount: 542, transactions: {} },
        ],
        numFlattened: 10,
        currentFlattened: {},
        transactionsToReturn: null,
        settings: {
          anonFeePercent: 0.5,
        },
      }
      PrepareIncoming.flattened(true, { junkParam: 1234 })
    })
    it('should run out of subaddresses and run the callback', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.runtime = {
        currentBatch: [
          { unique: 'ASD', amount: 546, transactions: {} },
          { unique: 'QWE', amount: 231, transactions: {} },
        ],
        remainingToFlatten: [
          { unique: 'ZXC', amount: 345, transactions: {} },
        ],
        numFlattened: 15,
        currentFlattened: {
          ASD: [100, 100, 100, 100, 100, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1],
        },
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.numFlattened).toBe(15)
          expect(data.currentFlattened).toEqual({
            ASD: [100, 100, 100, 100, 100, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1],
          })
          expect(data.currentBatch).toEqual([
            { unique: 'ASD', amount: 546, transactions: {} },
            { unique: 'QWE', amount: 231, transactions: {} },
          ])
          done()
        },
        transactionsToReturn: null,
      }
      const mockPrivateSettings = {
        maxAddresses: 20,
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('privateSettings', mockPrivateSettings)
      PrepareIncoming.flattened(true, { flattened: [100, 100, 10, 10, 10, 1] })
    })
    it('should get the flattened and move onto the next one', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      const mockFlattenTransactions = {
        incoming: (options, callback) => {
          expect(options.amountToFlatten).toBe(542)
          expect(callback).toBe(PrepareIncoming.flattened)
          expect(PrepareIncoming.runtime.remainingToFlatten).toEqual([{ unique: 'ASD', amount: 542, transactions: {} }])
          expect(PrepareIncoming.runtime.numFlattened).toBe(16)
          expect(PrepareIncoming.runtime.currentFlattened.QWE).toEqual([100, 100, 10, 10, 10, 1])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('FlattenTransactions', mockFlattenTransactions)
      PrepareIncoming.runtime = {
        remainingToFlatten: [
          { unique: 'QWE', amount: 231, transactions: {} },
          { unique: 'ASD', amount: 542, transactions: {} },
        ],
        numFlattened: 10,
        currentFlattened: {},
        transactionsToReturn: null,
        settings: {
          anonFeePercent: 0.5,
        },
      }
      PrepareIncoming.flattened(true, { flattened: [100, 100, 10, 10, 10, 1] })
    })
    it('should flatten the last one and run the callback', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockPrivateSettings = {
        maxAddresses: 1000,
      }
      PrepareIncoming.__set__('Logger', mockLogger)
      PrepareIncoming.__set__('privateSettings', mockPrivateSettings)
      PrepareIncoming.runtime = {
        currentBatch: [
          { unique: 'QWE', amount: 231, transactions: {} },
          { unique: 'ASD', amount: 542, transactions: {} },
        ],
        remainingToFlatten: [
          { unique: 'ASD', amount: 542, transactions: {} },
        ],
        numFlattened: 16,
        currentFlattened: {
          QWE: [100, 100, 10, 10, 10, 1],
        },
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.numFlattened).toBe(27)
          expect(data.currentFlattened).toEqual({
            QWE: [100, 100, 10, 10, 10, 1],
            ASD: [100, 100, 100, 100, 100, 10, 10, 10, 10, 1, 1],
          })
          expect(data.currentBatch).toEqual([
            { unique: 'QWE', amount: 231, transactions: {} },
            { unique: 'ASD', amount: 542, transactions: {} },
          ])
          done()
        },
        transactionsToReturn: null,
      }
      PrepareIncoming.flattened(true, { flattened: [100, 100, 100, 100, 100, 10, 10, 10, 10, 1, 1] })
    })
  })
})
