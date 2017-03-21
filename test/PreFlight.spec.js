'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')
const config = require('config')

const incomingSettings = config.get('INCOMING')

const PreFlight = rewire('../src/lib/PreFlight')

describe('[PreFlight]', () => {
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
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.run({
        junkParam: 'ASDFG',
      }, callback)
    })
    it('should receive correct params and call checkBlockHeight', (done) => {
      const callback = () => {}

      const mockNavClient = { test: 1 }
      const mockSubClient = { test: 2 }

      const mockNavCoin = {
        checkBlockHeight: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PreFlight.navBlocksChecked)
          expect(options).toBeA('object')
          expect(PreFlight.runtime).toEqual({
            callback,
            navClient: mockNavClient,
            subClient: mockSubClient,
            settings: incomingSettings,
          })
          done()
        },
      }

      PreFlight.__set__('NavCoin', mockNavCoin)

      PreFlight.run({
        navClient: mockNavClient,
        subClient: mockSubClient,
        settings: incomingSettings,
      }, callback)
    })
  })
  describe('(navBlocksChecked)', () => {
    it('should fail due to success being false', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.navBlocksChecked(false, {})
    })
    it('should fail due to data being undefined', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.navBlocksChecked(true)
    })
    it('should fail to set the tx fee', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
        navClient: {
          setTxFee: () => { return Promise.reject({ code: -17 }) },
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.navBlocksChecked(true, {
        balance: 100,
      })
    })
    it('should set the tx fee and run checkBlockHeight', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      const mockNavCoin = {
        checkBlockHeight: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PreFlight.subBlocksChecked)
          expect(options).toBeA('object')
          expect(PreFlight.runtime.navBalance).toBe(100)
          done()
        },
      }

      PreFlight.runtime = {
        navClient: {
          setTxFee: () => { return Promise.resolve() },
        },
        subClient: {
          setTxFee: () => { return Promise.resolve() },
        },
      }

      PreFlight.__set__('NavCoin', mockNavCoin)
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.navBlocksChecked(true, {
        balance: 100,
      })
    })
  })
  describe('(subBlocksChecked)', () => {
    it('should fail due to success being false', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.subBlocksChecked(false, {})
    })
    it('should fail due to data being undefined', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.subBlocksChecked(true)
    })
    it('should save the subBalance to memory and unlock the navClient', (done) => {
      const mockNavCoin = {
        unlockWallet: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PreFlight.navClientUnlocked)
          expect(options).toBeA('object')
          expect(options.type).toBe('navCoin')
          expect(PreFlight.runtime.subBalance).toBe(200)
          done()
        },
      }

      PreFlight.runtime = {
        navClient: {
          setTxFee: () => { return Promise.resolve() },
        },
        subClient: {
          setTxFee: () => { return Promise.resolve() },
        },
      }

      PreFlight.__set__('NavCoin', mockNavCoin)
      PreFlight.subBlocksChecked(true, {
        balance: 200,
      })
    })
  })
  describe('(navClientUnlocked)', () => {
    it('should fail due to success being false', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.navClientUnlocked(false, {})
    })
    it('should unlock the subClient', (done) => {
      const mockNavCoin = {
        unlockWallet: (options, parsedCallback) => {
          expect(parsedCallback).toBe(PreFlight.subClientUnlocked)
          expect(options).toBeA('object')
          expect(options.type).toBe('subChain')
          done()
        },
      }

      PreFlight.runtime = {
        navClient: {
          setTxFee: () => { return Promise.resolve() },
        },
        subClient: {
          setTxFee: () => { return Promise.resolve() },
        },
      }

      PreFlight.__set__('NavCoin', mockNavCoin)
      PreFlight.navClientUnlocked(true)
    })
  })
  describe('(subClientUnlocked)', () => {
    it('should fail due to success being false', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.subClientUnlocked(false, {})
    })
    it('should fail when unable to set the subchain tx-fee', (done) => {
      const mockLogger = {
        writeLog: sinon.spy(),
      }

      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(false)
          expect(data.message).toBeA('string')
          sinon.assert.calledOnce(mockLogger.writeLog)
          done()
        },
        subClient: {
          setTxFee: () => { return Promise.reject({ code: -99 }) },
        },
      }
      PreFlight.__set__('Logger', mockLogger)
      PreFlight.subClientUnlocked(true, {})
    })
    it('should return success to the callback', (done) => {
      PreFlight.runtime = {
        callback: (success, data) => {
          expect(success).toBe(true)
          expect(data).toBeA('object')
          expect(data.navBalance).toBe(100)
          expect(data.subBalance).toBe(200)
          done()
        },
        subClient: {
          setTxFee: () => { return Promise.resolve() },
        },
        navBalance: 100,
        subBalance: 200,
      }
      PreFlight.subClientUnlocked(true, {})
    })
  })
})
