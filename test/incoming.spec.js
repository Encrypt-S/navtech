'use strict'

const expect = require('expect')
const rewire = require('rewire')

const IncomingServer = rewire('../src/incoming')

describe('[NavCoin]', () => {
  describe('(unlockWallet)', () => {
    it('should not attempt to process', () => {
      IncomingServer.processing = true
      IncomingServer.currentBatchPrepared(false, { currentBatch: [1, 2, 3] })
      expect(IncomingServer.processing).toBe(false)
    })
  })
})
