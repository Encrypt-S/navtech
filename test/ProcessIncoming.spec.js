'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../src/settings/private.settings.json')

let ProcessIncoming = rewire('../src/lib/ProcessIncoming')

let mockLogger = {
    writeLog: sinon.spy(),
}

let mockRuntime = {
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

beforeEach(() => {
    ProcessIncoming = rewire('../src/lib/ProcessIncoming')
    mockLogger = {
        writeLog: sinon.spy()
    }
    mockRuntime = {}
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
            }
            mockRuntime = {
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
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.runtime = mockRuntime
            ProcessIncoming.transactionFailed()
            expect(ProcessIncoming.runtime.remainingTransactions.length).toBe(0)
            expect(ProcessIncoming.runtime.transactionsToReturn.length).toBe(1)
            done()
        })
    })
    describe('(checkDecrypted)', () => {
        it('should log a message out when success is false', (done) => {
            const mockTransactionFailed = () => {
                sinon.assert.calledOnce(mockLogger.writeLog)
                done()
            }
            ProcessIncoming.transactionFailed = mockTransactionFailed
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.checkDecrypted(false, {transaction:true,data:true})
        })
        it('should log a message out when isValid is false', (done) => {
            const callback = (success, data) => {
            }
            const addressInfo = {isvalid:false}
            mockRuntime = {
                callback,
                currentBatch: [],
                settings: {setting: true},
                subClient: {test: true},
                navClient: {
                    validateAddress: () => {
                        return Promise.resolve(addressInfo)
                    },
                    test: true
                },
                outgoingPubKey: '123443',
                subAddresses: [],
                transactionsToReturn: [],
                successfulSubTransactions: [],
                remainingTransactions: [],
            }
            ProcessIncoming.runtime = mockRuntime
            ProcessIncoming.transactionFailed = () => {
                sinon.assert.calledOnce(mockLogger.writeLog)
                done()
            }
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.checkDecrypted(true, {transaction:true,decrypted:true})
        })
        it('should log a message out when validateAddress call comes back false', (done) => {
            const callback = (success, data) => {
            }
            mockRuntime = {
                callback,
                currentBatch: [],
                settings: {setting: true},
                subClient: {test: true},
                navClient: {
                    validateAddress: () => {
                        return Promise.reject({message:'mock failure'})
                    },
                    test: true
                },
                outgoingPubKey: '123443',
                subAddresses: [],
                transactionsToReturn: [],
                successfulSubTransactions: [],
                remainingTransactions: [],
            }
            ProcessIncoming.runtime = mockRuntime
            ProcessIncoming.transactionFailed = () => {
                sinon.assert.calledOnce(mockLogger.writeLog)
                done()
            }
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.checkDecrypted(true, {transaction:true,decrypted:true})
        })

    })
    describe('(reEncryptAddress)', ()=> {

    })
    describe('(sentSubToOutgoing)', ()=> {
        it('should log a message out when success is false', (done) => {
            const mockTransactionFailed = () => {
                sinon.assert.calledOnce(mockLogger.writeLog)
                done()
            }
            ProcessIncoming.transactionFailed = mockTransactionFailed
            ProcessIncoming.__set__('Logger', mockLogger)
            ProcessIncoming.sentSubToOutgoing(false, {transaction:true,data:true})
        })
    })



})

