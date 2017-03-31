'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let SelectOutgoing = rewire('../src/lib/SelectOutgoing')

describe('[SelectOutgoing]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.run({ junkParam: 1234 }, callback)
    })
    it('should fail because no remotes found in settings', (done) => {
      const settings = { remote: [] }
      const navClient = {}
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_002')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.run({ settings, navClient }, callback)
    })
    it('should find the remotes and call pickServer', (done) => {
      const settings = { remote: [1, 2, 3] }
      const navClient = {}
      const callback = () => {}
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.callback).toBe(callback)
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([1, 2, 3])
        expect(SelectOutgoing.runtime.settings).toBe(settings)
        expect(SelectOutgoing.runtime.navClient).toBe(navClient)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.run({ settings, navClient }, callback)
    })
  })
  describe('(pickServer)', () => {
    before(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should fail when it runs out of remotes to try', (done) => {
      SelectOutgoing.runtime = {
        remoteCluster: [],
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_003')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.pickServer()
    })
    it('should pick a random server and call testOutgoing', (done) => {
      SelectOutgoing.runtime = {
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.testOutgoing = () => {
        expect(SelectOutgoing.runtime.chosenOutgoingIndex).toBeA('number')
        expect(SelectOutgoing.runtime.chosenOutgoing).toBeAn('object')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.pickServer()
    })
  })
  describe('(testOutgoing)', () => {
    before(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should make the request to the server', (done) => {
      const chosenOutgoing = { ipAddress: '192.168.1.1', port: '3000' }
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      const mockRequest = (options, callback) => {
        expect(callback).toBe(SelectOutgoing.gotServerResponse)
        expect(options.form.server_type).toBe('OUTGOING')
        expect(options.form.num_addresses).toBe(6)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('request', mockRequest)
      SelectOutgoing.testOutgoing(chosenOutgoing)
    })
  })
  describe('(gotServerResponse)', () => {
    before(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should fail due to error from the server and try the next one', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_004')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.gotServerResponse('some error')
    })
    it('should succeed and check the result the server provided', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.checkOutgoingCanTransact = (body, outgoingAddress) => {
        expect(outgoingAddress).toBe('192.168.1.1:3000')
        expect(body).toBe('{ "type": "SUCCESS" }')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.gotServerResponse('', 200, '{ "type": "SUCCESS" }')
    })
  })
  describe('(gotServerResponse)', () => {
    before(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should fail due to non json response from the server', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_005A')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact('NON JSON RESPONSE', '192.168.1.1:3000')
    })
    it('should fail due to non SUCCESS type', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_005')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact('{ "type": "FAILURE" }', '192.168.1.1:3000')
    })
    it('should fail due to no data param', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_006')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact('{ "type": "SUCCESS" }', '192.168.1.1:3000')
    })
    it('should fail due to incorrect data params', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_006')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const body = '{ "type": "SUCCESS", "data": { "nav_addresses": [], "nav_balance": 10000, "junkParam": "QWERTY" } }'
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact(body, '192.168.1.1:3000')
    })
    it('should fail due to incorrect server type', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_007')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const body = `{ "type": "SUCCESS", "data": { "nav_addresses": [], "nav_balance": 10000,
      "public_key": "QWERTY", "server_type": "INCOMING" } }`
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact(body, '192.168.1.1:3000')
    })
    it('should pass the checks and call checkPublicKey', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        settings: { secret: 'XXXX' },
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
      }
      SelectOutgoing.checkPublicKey = () => {
        expect(SelectOutgoing.runtime.outgoingServerData).toBeA('object')
        expect(SelectOutgoing.runtime.outgoingNavBalance).toBe(10000)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const body = `{ "type": "SUCCESS", "data": { "nav_addresses": [1, 2, 3], "nav_balance": 10000,
      "public_key": "QWERTY", "server_type": "OUTGOING" } }`
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.checkOutgoingCanTransact(body, '192.168.1.1:3000')
    })
  })
  describe('(checkPublicKey)', () => {
    beforeEach(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should fail to encrypt with the public key provided', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }
      const Exception = () => 'manual error'
      const ursaMock = {
        createPrivateKey: () => {
          return {
            encrypt: () => {
              throw new Exception()
            },
            decrypt: () => {
              return 'DECRYPTED_MESSAGE'
            },
          }
        },
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_009')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.checkPublicKey('TEST_DECRYPTED_DATA')
    })
    it('should encrypt but the encrypted data is bad', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }
      const ursaMock = {
        createPublicKey: () => {
          return {
            encrypt: () => {
              return 'TEST_ENCRYPTED_DATA'
            },
          }
        },
      }
      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_008')
        done()
      }
      const mockPrivateSettings = {
        encryptionOutput: { OUTGOING: 100 },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.__set__('privateSettings', mockPrivateSettings)
      SelectOutgoing.checkPublicKey()
    })
    it('should complete the encryption test and call hasNavAddresses', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }
      const ursaMock = {
        createPublicKey: () => {
          return {
            encrypt: () => {
              return 'TEST_ENCRYPTED_DATA'
            },
          }
        },
      }
      SelectOutgoing.hasNavAddresses = () => {
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockPrivateSettings = {
        encryptionOutput: { OUTGOING: 19 },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.__set__('privateSettings', mockPrivateSettings)
      SelectOutgoing.checkPublicKey()
    })
  })
  describe('(hasNavAddresses)', () => {
    beforeEach(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should not have any nav addresses returned and try the next server', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }

      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_010')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.hasNavAddresses()
    })
    it('should hav nav addresses and try to validate them', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }

      const NavCoin = {
        validateAddresses: (options, callback) => {
          expect(callback).toBe(SelectOutgoing.navAddressesValid)
          expect(options.addresses).toEqual([1, 2, 3])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('NavCoin', NavCoin)
      SelectOutgoing.hasNavAddresses()
    })
  })
  describe('(navAddressesValid)', () => {
    beforeEach(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should detect invalid addresses and try the next server', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }

      SelectOutgoing.pickServer = () => {
        expect(SelectOutgoing.runtime.remoteCluster).toEqual([
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ])
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'SEL_011')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.navAddressesValid(false)
    })
    it('should validate the addresses and get the encryption keys', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
      }

      const EncryptionKeys = {
        getEncryptionKeys: (options, callback) => {
          expect(callback).toBe(SelectOutgoing.encryptOutgoingAddresses)
          expect(options).toEqual({})
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('EncryptionKeys', EncryptionKeys)
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.navAddressesValid(true)
    })
  })
  describe('(encryptOutgoingAddresses)', () => {
    beforeEach(() => { // reset the rewired functions
      SelectOutgoing = rewire('../src/lib/SelectOutgoing')
    })
    it('should fail to get the encryption keys (returned false)', (done) => {
      SelectOutgoing.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_012')
          done()
        },
      }
      const keys = {
        privKeyFile: '1234',
        pubKeyFile: 'ASDF',
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.encryptOutgoingAddresses(false, keys)
    })
    it('should fail to get the encryption keys (no data object)', (done) => {
      SelectOutgoing.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_012')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.encryptOutgoingAddresses(true)
    })
    it('should fail to get the encryption keys (bad params)', (done) => {
      SelectOutgoing.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_012')
          done()
        },
      }
      const keys = {
        junkParam: '1234',
        pubKeyFile: 'ASDF',
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.encryptOutgoingAddresses(true, keys)
    })
    it('should fail to encrypt with the public key provided', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_014')
          done()
        },
      }
      const keys = {
        privKeyFile: './test/keys/private/1482278400000_public.pub',
        pubKeyFile: './test/keys/private/1482278400000_private.pem',
      }
      function Exception() {
        return 'custom error'
      }
      const ursaMock = {
        createPublicKey: () => {
          return {
            encrypt: () => {
              throw new Exception()
            },
          }
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.encryptOutgoingAddresses(true, keys)
    })
    it('should decrypt but the result is wrong', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.returnAllToSenders).toBe(true)
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'SEL_013')
          done()
        },
      }
      const fsMock = {
        readFileSync: () => {
        },
      }
      const keys = {
        privKeyFile: './test/keys/private/1482278400000_private.pem',
        pubKeyFile: './test/keys/private/1482278400000_public.pub',
      }
      const ursaMock = {
        createPublicKey: () => {
          return {
            encrypt: () => {
              return '[1, 2, 3]'
            },
          }
        },
        createPrivateKey: () => {
          return {
            decrypt: () => {
              return 'junkData'
            },
          }
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.__set__('fs', fsMock)
      SelectOutgoing.encryptOutgoingAddresses(true, keys)
    })
    it('should successfully encrypt and run the callback', (done) => {
      SelectOutgoing.runtime = {
        chosenOutgoing: { ipAddress: '192.168.1.1', port: '3000' },
        outgoingAddress: '192.168.1.1:3000',
        chosenOutgoingIndex: 0,
        remoteCluster: [
          { ipAddress: '192.168.1.1', port: '3000' },
          { ipAddress: '192.168.1.2', port: '3000' },
          { ipAddress: '192.168.1.3', port: '3000' },
        ],
        outgoingServerData: {
          nav_addresses: [1, 2, 3],
          nav_balance: 10000,
          public_key: 'QWERTY',
          server_type: 'OUTGOING',
        },
        outgoingPubKey: 'QWERTY',
        outgoingNavBalance: 10000,
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.chosenOutgoing).toEqual({ ipAddress: '192.168.1.1', port: '3000' })
          expect(data.outgoingNavBalance).toBe(10000)
          expect(data.outgoingPubKey).toBe('QWERTY')
          expect(data.holdingEncrypted).toBe('ENCRYPTED_DATA')
          expect(data.returnAllToSenders).toBe(false)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const fsMock = {
        readFileSync: () => {
        },
      }
      const keys = {
        privKeyFile: './test/keys/private/1482278400000_private.pem',
        pubKeyFile: './test/keys/private/1482278400000_public.pub',
      }
      const ursaMock = {
        createPublicKey: () => {
          return {
            encrypt: () => {
              return 'ENCRYPTED_DATA'
            },
          }
        },
        createPrivateKey: () => {
          return {
            decrypt: () => {
              return '[1,2,3]'
            },
          }
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      SelectOutgoing.__set__('Logger', mockLogger)
      SelectOutgoing.__set__('ursa', ursaMock)
      SelectOutgoing.__set__('fs', fsMock)
      SelectOutgoing.encryptOutgoingAddresses(true, keys)
    })
  })
})
