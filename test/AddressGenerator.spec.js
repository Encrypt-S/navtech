'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

let AddressGenerator = rewire('../src/lib/AddressGenerator')

describe('[AddressGenerator]', () => {
  describe('(generate)', () => {
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
      AddressGenerator.__set__('Logger', mockLogger)
      AddressGenerator.generate({
        junkParam: 'sdfsdfsd',
      }, callback)
    })
    it('should fail client.getAccountAddress with error -12', (done) => {
      const mockClient = {
        getAccountAddress: () => { return Promise.reject({ code: -12 }) },
      }

      AddressGenerator.runKeypoolRefill = () => {
        expect(true).toBe(true)
        done()
      }

      const callback = () => {}

      AddressGenerator.generate({
        accountName: 'incomingAccount',
        client: mockClient,
        maxAddresses: 100,
      }, callback)
    })
    it('should fail client.getAccountAddress catch all error', (done) => {
      const mockClient = {
        getAccountAddress: () => { return Promise.reject({ code: -17 }) },
      }

      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.code).toBe(-17)
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      AddressGenerator.__set__('Logger', mockLogger)
      AddressGenerator.generate({
        accountName: 'incomingAccount',
        client: mockClient,
        maxAddresses: 100,
      }, callback)
    })
    it('should get the account address and run getAccountAddressesForGeneration', (done) => {
      const mockClient = {
        getAccountAddress: () => { return Promise.resolve() },
      }

      const callback = () => {}

      AddressGenerator.getAccountAddressesForGeneration = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options).toBeA('object')
        done()
      }

      AddressGenerator.generate({
        accountName: 'incomingAccount',
        client: mockClient,
        maxAddresses: 100,
      }, callback)
    })
  })
  describe('(runKeypoolRefill)', () => {
    before(() => { // reset the rewired functions
      AddressGenerator = rewire('../src/lib/AddressGenerator')
    })
    it('should fail to refill the keypool', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.code).toBe(-99)
        sinon.assert.calledOnce(mockLogger.writeLog)
        done()
      }

      const mockClient = {
        keypoolRefill: () => { return Promise.reject({ code: -99 }) },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      AddressGenerator.__set__('Logger', mockLogger)
      AddressGenerator.runKeypoolRefill({
        client: mockClient,
      }, callback)
    })
    it('should refill the keypool and run generate again', (done) => {
      const callback = () => {}

      AddressGenerator.generate = (options, parsedCallback) => {
        expect(parsedCallback).toBe(callback)
        expect(options).toBeA('object')
        done()
      }

      const mockClient = {
        keypoolRefill: () => { return Promise.resolve() },
      }

      const mockLogger = {
        writeLog: sinon.spy(),
      }
      AddressGenerator.__set__('Logger', mockLogger)
      AddressGenerator.runKeypoolRefill({
        client: mockClient,
      }, callback)
    })
  })
  describe('(getAccountAddressesForGeneration)', () => {
    before(() => { // reset the rewired functions
      AddressGenerator = rewire('../src/lib/AddressGenerator')
    })
    it('fail client.getAddressesByAccount with error 12', (done) => {
      const mockClient = {
        getAddressesByAccount: () => { return Promise.reject({ code: -12 }) },
      }

      AddressGenerator.runKeypoolRefill = () => {
        expect(true).toBe(true)
        done()
      }

      const callback = () => {}

      AddressGenerator.getAccountAddressesForGeneration({
        accountName: 'incomingAccount',
        client: mockClient,
        maxAddresses: 100,
      }, callback)
    })
  })
})
