'use strict'

const expect = require('expect')
const rewire = require('rewire')
const sinon = require('sinon')

const FlattenTransactions = rewire('../src/lib/FlattenTransactions')

describe('[FlattenTransactions]', () => {
  describe('(incoming)', () => {
    it('should fail on params', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'FLT_001')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      FlattenTransactions.__set__('Logger', mockLogger)
      FlattenTransactions.incoming({
        memes: 'HARAMBE',
      }, callback)
    })
    it('should flatten transactions 1126.65', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(10)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[1]).toBe(100)
        expect(data.flattened[2]).toBe(10)
        expect(data.flattened[3]).toBe(10)
        expect(data.flattened[4]).toBe(1)
        expect(data.flattened[5]).toBe(1)
        expect(data.flattened[6]).toBe(1)
        expect(data.flattened[7]).toBe(1)
        expect(data.flattened[8]).toBe(1)
        expect(data.flattened[9]).toBe(1.65)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(1126.65)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 1126.65,
      }, callback)
    })
    it('should flatten transactions 10', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(10)
        expect(data.flattened[0]).toBe(1)
        expect(data.flattened[9]).toBe(1)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(10)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 10,
      }, callback)
    })
    it('should flatten transactions 10000', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(10)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[9]).toBe(1000)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(10000)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 10000,
      }, callback)
    })
    it('should flatten transactions 100.99999999', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(10)
        expect(data.flattened[0]).toBe(10)
        expect(data.flattened[9]).toBe(10.99999999)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(100.99999999)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 100.99999999,
      }, callback)
    })
    it('should flatten transactions 9999.99999999', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(36)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[9]).toBe(100)
        expect(data.flattened[18]).toBe(10)
        expect(data.flattened[27]).toBe(1)
        expect(data.flattened[35]).toBe(1.99999999)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(9999.99999999)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 9999.99999999,
      }, callback)
    })
    it('should flatten transactions 333.33333333', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(9)
        expect(data.flattened[0]).toBe(100)
        expect(data.flattened[3]).toBe(10)
        expect(data.flattened[6]).toBe(1)
        expect(data.flattened[8]).toBe(1.33333333)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        expect(safeReduced).toBe(333.33333333)
        done()
      }
      FlattenTransactions.incoming({
        totalToSend: 333.33333333,
      }, callback)
    })
    it('should fail to flatten', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        sinon.assert.calledOnce(mockLogger.writeLog)
        sinon.assert.calledWith(mockLogger.writeLog, 'FLT_002')
        done()
      }
      const mockLogger = {
        writeLog: sinon.spy(),
      }
      FlattenTransactions.__set__('Logger', mockLogger)
      FlattenTransactions.incoming({
        totalToSend: 'XYZ',
      }, callback)
    })
  })
})
