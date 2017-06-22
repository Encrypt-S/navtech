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
      const amount = 1126.65
      const callback = (success, data) => {
        expect(success).toBe(true)
        console.log(data)
        expect(data.flattened.length).toBe(5)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[1]).toBe(100)
        expect(data.flattened[2]).toBe(10)
        expect(data.flattened[3]).toBe(10)
        expect(data.flattened[4]).toBe(1.04477612)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 10', (done) => {
      const amount = 10
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(9)
        expect(data.flattened[0]).toBe(1)
        expect(data.flattened[8]).toBe(1.95024876)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 10000', (done) => {
      const amount = 10000
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(23)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[9]).toBe(100)
        expect(data.flattened[18]).toBe(10)
        expect(data.flattened[22]).toBe(10.24875622)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 100.99999999', (done) => {
      const amount = 100.99999999
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(10)
        expect(data.flattened[0]).toBe(10)
        expect(data.flattened[9]).toBe(10.49751243)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 9999.99999999', (done) => {
      const amount = 9999.99999999
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(23)
        expect(data.flattened[0]).toBe(1000)
        expect(data.flattened[9]).toBe(100)
        expect(data.flattened[18]).toBe(10)
        expect(data.flattened[22]).toBe(10.24875621)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 333.33333333', (done) => {
      const amount = 333.33333333
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(7)
        expect(data.flattened[0]).toBe(100)
        expect(data.flattened[3]).toBe(10)
        expect(data.flattened[6]).toBe(1.67495854)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 51', (done) => {
      const amount = 51
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(5)
        expect(data.flattened[0]).toBe(10)
        expect(data.flattened[4]).toBe(10.74626866)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
      }, callback)
    })
    it('should flatten transactions 201', (done) => {
      const amount = 201
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.flattened.length).toBe(2)
        expect(data.flattened[0]).toBe(100)
        expect(data.flattened[1]).toBe(100)
        const reduced = data.flattened.reduce((acc, x) => x + acc)
        const safeReduced = Math.round(reduced * 100000000) / 100000000
        const safeExpected = Math.round((amount / 1.005) * 100000000) / 100000000
        expect(safeReduced).toBe(safeExpected)
        done()
      }
      FlattenTransactions.incoming({
        amountToFlatten: amount,
        anonFeePercent: 0.5,
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
        amountToFlatten: 'XYZ',
        anonFeePercent: 0.5,
      }, callback)
    })
  })
})
