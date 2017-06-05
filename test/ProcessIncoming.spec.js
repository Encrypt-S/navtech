'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let ProcessIncoming = rewire('../src/lib/ProcessIncoming')

let mockLogger = {
  writeLog: sinon.spy(),
}

let mockRuntime = {
  currentBatch: [],
  settings: { setting: true },
  subClient: { test: true },
  navClient: { test: true },
  outgoingPubKey: '123443',
  subAddresses: [],
  transactionsToReturn: [],
  successfulSubTransactions: [],
  remainingTransactions: [],
}

beforeEach(() => {
  ProcessIncoming = rewire('../src/lib/ProcessIncoming')
  mockLogger = {
    writeLog: sinon.spy(),
  }
  mockRuntime = {}
})

describe('[ProcessIncoming]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_001')
        done()
      }

      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.run({ junkParam: 1234 }, callback)
    })
    it('should fail to get the current block height', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_001A')
        done()
      }
      const mockOptions = {
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          getBlockCount: () => {
            return Promise.reject({ err: { code: -21 } })
          },
        },
        outgoingPubKey: '123443',
        subAddresses: [],
        currentFlattened: [],
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.run(mockOptions, callback)
    })
    it('should set the variables into runtime and call processPending', (done) => {
      ProcessIncoming.processPending = () => {
        expect(ProcessIncoming.runtime.callback).toBe(callback)
        expect(ProcessIncoming.runtime.currentBatch).toBe(mockOptions.currentBatch)
        expect(ProcessIncoming.runtime.settings).toBe(mockOptions.settings)
        expect(ProcessIncoming.runtime.subClient).toBe(mockOptions.subClient)
        expect(ProcessIncoming.runtime.navClient).toBe(mockOptions.navClient)
        expect(ProcessIncoming.runtime.outgoingPubKey).toBe(mockOptions.outgoingPubKey)
        expect(ProcessIncoming.runtime.subAddresses).toBe(mockOptions.subAddresses)
        expect(ProcessIncoming.runtime.currentFlattened).toBe(mockOptions.currentFlattened)
        expect(ProcessIncoming.runtime.currentBlockHeight).toBe(1000)
        done()
      }
      const callback = () => {}
      const mockOptions = {
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          getBlockCount: () => {
            return Promise.resolve(1000)
          },
        },
        outgoingPubKey: '123443',
        subAddresses: [],
        currentFlattened: [],
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.run(mockOptions, callback)
    })
  })
  describe('(processPending)', () => {
    it('should callback with success when remainingTransactions < 1', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.successfulSubTransactions).toEqual(['1234'])
        expect(data.transactionsToReturn).toEqual('2345')
        done()
      }
      ProcessIncoming.runtime = {
        remainingTransactions: [],
        successfulSubTransactions: ['1234'],
        transactionsToReturn: ['2345'],
        callback,
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.processPending()
    })
    it('should call getEncrypted', (done) => {
      ProcessIncoming.runtime = {
        navClient: { test: true },
        remainingTransactions: ['ABC'],
      }

      const mockEncryptedData = {
        getEncrypted: (options, callback) => {
          expect(options.transaction).toBe('ABC')
          expect(options.client).toBe(ProcessIncoming.runtime.navClient)
          expect(callback).toBe(ProcessIncoming.checkDecrypted)
          done()
        },
      }

      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('EncryptedData', mockEncryptedData)
      ProcessIncoming.processPending()
    })
  })
  describe('(transactionFailed)', () => {
    it('should transfer tx from remainingTransactions to transactionsToReturn and call procesPending', (done) => {
      ProcessIncoming.runtime = {
        transactionsToReturn: [],
        remainingTransactions: ['1234', '2345'],
      }
      ProcessIncoming.processPending = () => {
        expect(ProcessIncoming.runtime.remainingTransactions).toEqual(['2345'])
        expect(ProcessIncoming.runtime.transactionsToReturn).toEqual(['1234'])
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.transactionFailed()
    })
  })
  describe('(checkDecrypted)', () => {
    it('should log a message out when success is false', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_002')
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(false, { transaction: true, data: true })
    })
    it('should log a message out when n or t is not found in data', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_002')
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: true, decrypted: { x: true, y: false } })
    })
    it('should log a message out when the transaction is not parsed', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_002')
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { decrypted: { n: 'XYZ', t: 120 } })
    })
    it('should log a message out when isValid is false', (done) => {
      mockRuntime = {
        navClient: {
          validateAddress: () => {
            return Promise.resolve({ isvalid: false })
          },
        },
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.transactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_003')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: true, decrypted: { n: 'XYZ', t: 120 } })
    })
    it('should log a message out when validateAddress call comes back false', (done) => {
      mockRuntime = {
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
        },
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.transactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_004')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: true, decrypted: { n: 'XYZ', t: 120 } })
    })
    it('should call processPartial if everything has worked', (done) => {
      ProcessIncoming.runtime = {
        navClient: {
          validateAddress: () => {
            return Promise.resolve({ isvalid: true })
          },
        },
        currentFlattened: {
          ABC: [100, 100, 100, 10, 10, 1],
        },
      }
      ProcessIncoming.processPartial = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(ProcessIncoming.runtime.destination).toBe('XYZ')
        expect(ProcessIncoming.runtime.maxDelay).toBe(120)
        expect(ProcessIncoming.runtime.remainingFlattened).toEqual([100, 100, 100, 10, 10, 1])
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: { txid: 'ABC', amount: 321 }, decrypted: { n: 'XYZ', t: 120 } })
    })
  })
  describe('(processPartial)', () => {
    it('should call processPending when no more partials to process', (done) => {
      ProcessIncoming.runtime = {
        remainingFlattened: [],
        remainingTransactions: [{ txid: 'QWE', amount: 100 }, { txid: 'ASD', amount: 100 }],
        successfulSubTransactions: [],
      }
      ProcessIncoming.processPending = () => {
        expect(ProcessIncoming.runtime.remainingTransactions).toEqual([{ txid: 'ASD', amount: 100 }])
        expect(ProcessIncoming.runtime.successfulSubTransactions).toEqual([{ txid: 'QWE', amount: 100 }])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.processPartial()
    })
    it('should call reEncryptAddress when still more partials to process', (done) => {
      ProcessIncoming.runtime = {
        remainingFlattened: [100, 100],
        remainingTransactions: [{ txid: 'QWE', amount: 100 }, { txid: 'ASD', amount: 100 }],
        successfulSubTransactions: [],
        destination: 'ABC',
        maxDelay: 120,
      }
      ProcessIncoming.reEncryptAddress = (destination, maxDelay, transaction, flattened, counter) => {
        expect(destination).toBe('ABC')
        expect(maxDelay).toBe(120)
        expect(transaction).toEqual({ txid: 'QWE', amount: 100 })
        expect(flattened).toBe(100)
        expect(counter).toBe(0)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.processPartial()
    })
  })
  describe('(partialFailed)', () => {
    it('should call the logger and a false callback', (done) => {
      ProcessIncoming.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'PROI_009')
          expect(data.message).toBeA('string')
          done()
        },
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.partialFailed()
    })
  })
  describe('(reEncryptAddress)', () => {
    it('should log a message when the encryption fails by exception', (done) => {
      const Exception = () => 'manual error'
      ProcessIncoming.runtime = {
        outgoingPubKey: {
          encrypt: () => {
            throw new Exception()
          },
        },
      }
      ProcessIncoming.partialFailed = (transaction) => {
        expect(transaction).toEqual({ txid: 'ABC', amount: 1000 })
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_007')
        done()
      }
      const mockPrivateSettings = {
        encryptionOutput: {
          OUTGOING: 5,
        },
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('privateSettings', mockPrivateSettings)
      ProcessIncoming.reEncryptAddress('XYZ', 120, { txid: 'ABC', amount: 1000 }, 100, 0)
    })
    it('should log a message when the encryption is the wrong length', (done) => {
      ProcessIncoming.runtime = {
        outgoingPubKey: {
          encrypt: () => { return '12345' },
        },
        currentBlockHeight: 1000,
        settings: {
          secret: 'ABCDEFG',
        },
      }
      const mockPrivateSettings = {
        encryptionOutput: {
          OUTGOING: 177,
        },
        maxEncryptionAttempts: 10,
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('privateSettings', mockPrivateSettings)
      ProcessIncoming.reEncryptAddress('XYZ', 120, { txid: 'ABC', amount: 1000 }, 100, 0)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'PROI_005')
      done()
    })
    it('should log a message when the max attempts is reached', (done) => {
      ProcessIncoming.runtime = {
        outgoingPubKey: {
          encrypt: () => { return '12345' },
        },
        currentBlockHeight: 1000,
        settings: {
          secret: 'ABCDEFG',
        },
      }
      const mockPrivateSettings = {
        encryptionOutput: {
          OUTGOING: 177,
        },
        maxEncryptionAttempts: 10,
      }
      ProcessIncoming.partialFailed = (transaction) => {
        expect(transaction).toEqual({ txid: 'ABC', amount: 1000 })
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_006')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('privateSettings', mockPrivateSettings)
      ProcessIncoming.reEncryptAddress('XYZ', 120, { txid: 'ABC', amount: 1000 }, 100, 10)
    })
    it('should call makeSubchainTx when everything okay', (done) => {
      ProcessIncoming.runtime = {
        outgoingPubKey: {
          encrypt: () => {
            return '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456'
                 + '789012345678901234567890123456789012345678901234567890123456789012345678901234567890==' },
        },
        currentBlockHeight: 1000,
        settings: {
          secret: 'ABCDEFG',
        },
      }
      const mockPrivateSettings = {
        encryptionOutput: {
          OUTGOING: 172,
        },
        maxEncryptionAttempts: 0,
      }
      ProcessIncoming.makeSubchainTx = (encrypted, transaction) => {
        expect(encrypted).toEqual(ProcessIncoming.runtime.outgoingPubKey.encrypt())
        expect(transaction).toEqual({ txid: 'ABC', amount: 1000 })
        done()
      }

      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('privateSettings', mockPrivateSettings)
      ProcessIncoming.reEncryptAddress('XYZ', 120, { txid: 'ABC', amount: 1000 }, 100, 10)
    })
  })
  describe('makeSubchainTx', () => {
    it('should call sendToAddress', (done) => {
      ProcessIncoming.runtime = {
        subClient: { test: true },
        subAddresses: ['1234'],
      }
      const mockPrivateSettings = {
        subCoinsPerTx: 1,
      }
      const mockSendToAddress = {
        send: (options, callback) => {
          expect(options.client).toEqual(ProcessIncoming.runtime.subClient)
          expect(options.address).toBe('1234')
          expect(options.amount).toBe(1)
          expect(options.encrypted).toBe('ASD')
          expect(options.transaction).toBe('ZXC')
          expect(callback).toBe(ProcessIncoming.sentSubToOutgoing)
          done()
        },
      }
      ProcessIncoming.__set__('SendToAddress', mockSendToAddress)
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('privateSettings', mockPrivateSettings)
      ProcessIncoming.makeSubchainTx('ASD', 'ZXC')
    })
  })
  describe('(sentSubToOutgoing)', () => {
    it('should log a message out when success is false', (done) => {
      ProcessIncoming.partialFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_008')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.sentSubToOutgoing(false, { transaction: true, data: true })
    })
    it('should log a message out when no data is false', (done) => {
      ProcessIncoming.partialFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_008')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.sentSubToOutgoing(true, { sendOutcome: false, data: true })
    })
    it('should move on to the next partial transaction to send', (done) => {
      ProcessIncoming.processPartial = () => {
        expect(ProcessIncoming.runtime.subAddresses).toEqual(['2345', '3456'])
        expect(ProcessIncoming.runtime.remainingFlattened).toEqual([1, 1.1234])
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.runtime = {
        subAddresses: ['1234', '2345', '3456'],
        remainingFlattened: [100, 1, 1.1234],
      }
      ProcessIncoming.sentSubToOutgoing(true, { sendOutcome: true, transaction: '1234' })
    })
  })
})
