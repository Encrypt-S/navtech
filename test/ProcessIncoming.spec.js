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
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }

      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.run({ junkParam: 1234 }, callback)
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
        done()
      }
      const callback = () => {}
      const mockOptions = {
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: { test: true },
        outgoingPubKey: '123443',
        subAddresses: [],
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.run(mockOptions, callback)
    })
  })
  describe('(processPending)', () => {
    it('should callback with success when remainingTransactions < 1', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.successfulSubTransactions.length).toBe(0)
        expect(data.transactionsToReturn.length).toBe(0)
        done()
      }
      mockRuntime = {
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: { test: true },
        outgoingPubKey: '123443',
        subAddresses: [],
        remainingTransactions: [],
        successfulSubTransactions: [],
        transactionsToReturn: [],
        callback,
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.processPending()
    })
    it('should call getEncrypted', (done) => {
      mockRuntime = {
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: { test: true },
        outgoingPubKey: '123443',
        subAddresses: [],
        remainingTransactions: ['ABC'],
        successfulSubTransactions: [],
        transactionsToReturn: [],
      }

      const mockEncryptedData = {
        getEncrypted: (options, callback) => {
          expect(options.transaction).toBe('ABC')
          expect(options.client).toBe(mockRuntime.navClient)
          expect(callback).toBe(ProcessIncoming.checkDecrypted)
          done()
        },
      }

      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.__set__('EncryptedData', mockEncryptedData)
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.processPending()
    })
  })
  describe('(transactionFailed)', () => {
    it('should transfer policy from remainingTransactions to TransactionsToReturn when failed', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
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
      const callback = () => {}
      const addressInfo = { isvalid: false }
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.resolve(addressInfo)
          },
          test: true,
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
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_003')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: true, decrypted: { n: 'XYZ', t: 120 } })
    })
    it('should log a message out when validateAddress call comes back false', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
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
        sinon.assert.calledWith(mockLogger.writeLog, 'PROI_004')
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: true, decrypted: { n: 'XYZ', t: 120 } })
    })
    it('should call reEncryptAddress if everything has worked', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.resolve({ isvalid: true })
          },
          test: true,
        },
        outgoingPubKey: '123443',
        subAddresses: [],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: [],
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.reEncryptAddress = (decrypted, transaction, counter) => {
        sinon.assert.notCalled(mockLogger.writeLog)
        expect(decrypted).toEqual({ n: 'XYZ', t: 120 })
        expect(transaction).toBe('ABC')
        expect(counter).toBe(0)
        done()
      }
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.checkDecrypted(true, { transaction: 'ABC', decrypted: { n: 'XYZ', t: 120 } })
    })
  })
  describe('(reEncryptAddress)', () => {
    it('should log a message when the encryption fails', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => { return '12345' },
        },
        subAddresses: [],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: [],
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.reEncryptAddress({ n: 'XYZ', t: 120 }, 'ABC', 0)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'PROI_005')
      done()
    })
    it('should log a message when the counter exceeds the limit', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => { return '00000000' },
        },
        subAddresses: [],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: [],
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.reEncryptAddress({ n: 'XYZ', t: 120 }, 'ABC', 11)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'PROI_006')
      done()
    })
    it('should call makeSubchainTx when everything okay', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => {
            return '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456'
                 + '789012345678901234567890123456789012345678901234567890123456789012345678901234567890==' },
        },
        subAddresses: [],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: [],
      }

      ProcessIncoming.makeSubchainTx = (encrypted, transaction) => {
        expect(encrypted).toBe(mockRuntime.outgoingPubKey.encrypt())
        expect(transaction).toBe('ABC')
        done()
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.reEncryptAddress({ n: 'XYZ', t: 120 }, 'ABC', 0)
    })
    it('should catch errors thrown by the encryption', (done) => {
      const callback = () => {}
      const Exception = () => 'manual error'
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => {
            throw new Exception()
          },
        },
        subAddresses: [],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: [],
      }

      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.reEncryptAddress({ n: 'XYZ', t: 120 }, 'ABC', 0)
      sinon.assert.calledOnce(mockLogger.writeLog)
      sinon.assert.calledWith(mockLogger.writeLog, 'PROI_007')
      done()
    })
  })
  describe('(sentSubToOutgoing)', () => {
    it('should log a message out when success is false', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.sentSubToOutgoing(false, { transaction: true, data: true })
    })
    it('should log a message out when no data is false', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.sentSubToOutgoing(true, { sendOutcome: false, data: true })
    })
    it('should remove data from subAddresses and remainingTransactions and add to successfulSubTransactions', (done) => {
      const mockTransactionFailed = () => {
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      ProcessIncoming.transactionFailed = mockTransactionFailed
      ProcessIncoming.__set__('Logger', mockLogger)
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => { return '00000000' },
        },
        subAddresses: ['1234'],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: ['1234'],
      }
      ProcessIncoming.runtime = mockRuntime
      ProcessIncoming.sentSubToOutgoing(true, { sendOutcome: true, transaction: '1234' })
      expect(mockRuntime.subAddresses.length).toBe(0)
      expect(mockRuntime.remainingTransactions.length).toBe(0)
      expect(mockRuntime.successfulSubTransactions.length).toBe(1)
      done()
    })
  })
  describe('makeSubchainTx', () => {
    it('should call sendToAddress', (done) => {
      const callback = () => {}
      mockRuntime = {
        callback,
        currentBatch: [],
        settings: { setting: true },
        subClient: { test: true },
        navClient: {
          validateAddress: () => {
            return Promise.reject({ message: 'mock failure' })
          },
          test: true,
        },
        outgoingPubKey: {
          encrypt: () => { return '00000000' },
        },
        subAddresses: ['1234'],
        transactionsToReturn: [],
        successfulSubTransactions: [],
        remainingTransactions: ['1234'],
      }
      ProcessIncoming.runtime = mockRuntime
      const mockSendToAddress = {
        send: sinon.spy(),
      }
      ProcessIncoming.__set__('SendToAddress', mockSendToAddress)
      ProcessIncoming.__set__('Logger', mockLogger)
      ProcessIncoming.makeSubchainTx('test', 'test')
      sinon.assert.calledOnce(mockSendToAddress.send)
      done()
    })
  })
})
