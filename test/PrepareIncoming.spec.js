'use strict'

const expect = require('expect')
const rewire = require('rewire')

const PrepareIncoming = rewire('../src/lib/PrepareIncoming')

describe('[PrepareIncoming]', () => {
  describe('(unlockWallet)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      PrepareIncoming.pruneUnspent({}, callback)
    })
    it('should proceed past params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      const options = {
        currentPending: [{
          amount: 10,
        }],
        subBalance: 0,
        maxAmount: 1000,
      }
      PrepareIncoming.pruneUnspent(options, callback)
    })
  })
})
