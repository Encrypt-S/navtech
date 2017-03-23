'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../src/settings/private.settings.json')

let ProcessIncoming = rewire('../src/lib/ProcessIncoming')

beforeEach(() => {
    ProcessIncoming = rewire('../src/lib/ProcessIncoming')
})

describe('[ProcessIncoming]', () => {
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
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.run({junkParam: 1234}, callback)
        })
        it('should callback with success when remainingTransactions < 1', (done) => {
            const callback = (success, data) => {
                expect(success).toBe(true)
                expect(data.successfulSubTransactions.length).toBe(0)
                expect(data.transactionsToReturn.length).toBe(0)
                done()
            }
            const mockLogger = {
                writeLog: sinon.spy(),
            }
            const mockOptions = {
                currentBatch: [],
                settings: {setting: true},
                subClient: {test: true},
                navClient: {test: true},
                outgoingPubKey: '123443',
                subAddresses: [],
            }
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.run(mockOptions, callback)
        })
    })
    describe('(transActionFailed)', () => {
        it('should transfer policy from remainingTransactions to TransactionsToReturn when failed', (done) => {
            const callback = (success, data) => {
                // expect(success).toBe(true)
                // expect(ProcessIncoming.runtime.remainingTransactions.length).toBe(0)
                // expect(ProcessIncoming.runtime.transactionsToReturn.length).toBe(1)
                // done()
            }
            const mockRuntime = {
                callback,
                currentBatch: [],
                settings: {setting: true},
                subClient: {test: true},
                navClient: {test: true},
                outgoingPubKey: '123443',
                subAddresses: [],
                transactionsToReturn: [],
                successfulSubTransactions: [],
                remainingTransactions: [],
            }
            ProcessIncoming.__set__('EncryptedData',mockEncryptedData)
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.runtime = mockRuntime
            // ProcessIncoming.run(mockOptions,callback)
            ProcessIncoming.transactionFailed()
            expect(ProcessIncoming.runtime.remainingTransactions.length).toBe(0)
            expect(ProcessIncoming.runtime.transactionsToReturn.length).toBe(1)
            done()
        })


    })
})

