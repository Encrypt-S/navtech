'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')

describe('[RetrieveSubchainAddresses]', () => {
  describe('(run)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'RSC_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.run({ junkParam: 1234 }, callback)
    })
    it('should get the right params and call getSubAddresses', (done) => {
      const callback = () => {}
      const subClient = { getinfo: () => {} }
      const chosenOutgoing = { ipAddress: '123.123.123.123' }
      const numAddresses = 10
      RetrieveSubchainAddresses.getSubAddresses = () => {
        expect(RetrieveSubchainAddresses.runtime.callback).toBe(callback)
        expect(RetrieveSubchainAddresses.runtime.subClient).toBe(subClient)
        expect(RetrieveSubchainAddresses.runtime.chosenOutgoing).toBe(chosenOutgoing)
        expect(RetrieveSubchainAddresses.runtime.numAddresses).toBe(numAddresses)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.run({ subClient, chosenOutgoing, numAddresses }, callback)
    })
  })
  describe('(getSubAddresses)', () => {
    before(() => { // reset the rewired functions
      RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')
    })
    it('should build the request and send it to the outgoing server', (done) => {
      const chosenOutgoing = { ipAddress: '123.123.123.123', port: '3000' }
      const numAddresses = 10
      RetrieveSubchainAddresses.runtime = {
        chosenOutgoing,
        numAddresses,
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      const mockRequest = (options, callback) => {
        expect(RetrieveSubchainAddresses.runtime.outgoingAddress).toBe(chosenOutgoing.ipAddress + ':' + chosenOutgoing.port)
        expect(options.form.type).toBe('SUBCHAIN')
        expect(options.form.account).toBe('OUTGOING')
        expect(options.form.num_addresses).toBe(10)
        expect(callback).toBe(RetrieveSubchainAddresses.requestResponse)
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.__set__('request', mockRequest)
      RetrieveSubchainAddresses.getSubAddresses()
    })
  })
  it('should build the request and send it to the outgoing server without port', (done) => {
    const chosenOutgoing = { ipAddress: '123.123.123.123' }
    const numAddresses = 50
    RetrieveSubchainAddresses.runtime = {
      chosenOutgoing,
      numAddresses,
    }
    const mockLogger = {
      writeLog: sinon.spy(),
    }
    const mockRequest = (options, callback) => {
      expect(RetrieveSubchainAddresses.runtime.outgoingAddress).toBe(chosenOutgoing.ipAddress)
      expect(options.form.type).toBe('SUBCHAIN')
      expect(options.form.account).toBe('OUTGOING')
      expect(options.form.num_addresses).toBe(50)
      expect(callback).toBe(RetrieveSubchainAddresses.requestResponse)
      sinon.assert.notCalled(mockLogger.writeLog)
      done()
    }
    RetrieveSubchainAddresses.__set__('Logger', mockLogger)
    RetrieveSubchainAddresses.__set__('request', mockRequest)
    RetrieveSubchainAddresses.getSubAddresses()
  })
  describe('(requestResponse)', () => {
    before(() => { // reset the rewired functions
      RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')
    })
    it('should get an error from the outgoing server', (done) => {
      const chosenOutgoing = { ipAddress: '123.123.123.123', port: '3000' }
      const numAddresses = 55
      RetrieveSubchainAddresses.runtime = {
        chosenOutgoing,
        numAddresses,
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_004')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.requestResponse('some error', 404, 'body of response')
    })
    it('should get no error and continue', (done) => {
      const chosenOutgoing = { ipAddress: '123.123.123.123', port: '3000' }
      const numAddresses = 5
      RetrieveSubchainAddresses.runtime = {
        outgoingAddress: chosenOutgoing.ipAddress + ':' + chosenOutgoing.port,
        numAddresses,
        callback: () => {},
      }
      RetrieveSubchainAddresses.checkOutgoingCanTransact = (body, outgoingAddress) => {
        expect(body).toBe('body of response')
        expect(outgoingAddress).toBe('123.123.123.123:3000')
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.requestResponse('', 200, 'body of response')
    })
  })
  describe('(checkOutgoingCanTransact)', () => {
    before(() => { // reset the rewired functions
      RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')
    })
    it('should get a non json response from the server and call false callback', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_005A')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('some error', outgoingAddress)
    })
    it('should get a non success json response', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_005')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('{ "junkParam": "1234" }', outgoingAddress)
    })
    it('should fail because no type was present in the response', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_005')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('{ "type": "FAIL" }', outgoingAddress)
    })
    it('should fail because the repsone type was not "SUCCESS"', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_005')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('{ "type": "FAIL" }', outgoingAddress)
    })
    it('should fail no addresses in the response data', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_006')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('{ "type": "SUCCESS", "data": { "junkParam": [] } }', outgoingAddress)
    })
    it('should continue and call checkSubAddresses', (done) => {
      const outgoingAddress = '123.123.123.123:3000'
      RetrieveSubchainAddresses.checkSubAddresses = (addresses) => {
        expect(addresses).toEqual([1, 2, 3, 4])
        sinon.assert.notCalled(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkOutgoingCanTransact('{ "type": "SUCCESS", "data": { "addresses": [1, 2, 3, 4] } }', outgoingAddress)
    })
  })
  describe('(checkSubAddresses)', () => {
    before(() => { // reset the rewired functions
      RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')
    })
    it('should fail because 0 addresses received from server', (done) => {
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_007')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkSubAddresses([])
    })
    it('should fail because less addressses than needed were received from server', (done) => {
      RetrieveSubchainAddresses.runtime = {
        numAddresses: 10,
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_008')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.checkSubAddresses([1, 2])
    })
    it('should receive the correct number of addresses and continue to the validator', (done) => {
      RetrieveSubchainAddresses.runtime = {
        numAddresses: 3,
      }
      const NavCoin = {
        validateAddresses: (options, callback) => {
          expect(callback).toBe(RetrieveSubchainAddresses.subAddressesValid)
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.__set__('NavCoin', NavCoin)
      RetrieveSubchainAddresses.checkSubAddresses([1, 2, 3])
    })
  })
  describe('(subAddressesValid)', () => {
    before(() => { // reset the rewired functions
      RetrieveSubchainAddresses = rewire('../src/lib/RetrieveSubchainAddresses')
    })
    it('should fail from error within the address validator', (done) => {
      RetrieveSubchainAddresses.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          sinon.assert.calledWith(mockLogger.writeLog, 'RSC_009')
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.subAddressesValid(false)
    })
    it('should succeed and return the subchain addresses', (done) => {
      RetrieveSubchainAddresses.runtime = {
        outgoingSubAddresses: [1, 2, 3],
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data.subAddresses).toEqual([1, 2, 3])
          sinon.assert.notCalled(mockLogger.writeLog)
          done()
        },
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      RetrieveSubchainAddresses.__set__('Logger', mockLogger)
      RetrieveSubchainAddresses.subAddressesValid(true)
    })
  })
})
