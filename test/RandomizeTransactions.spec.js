'use strict'

const expect = require('expect')
const rewire = require('rewire')

let RandomizeTransactions = rewire('../src/lib/RandomizeTransactions')

describe('[RandomizeTransactions]', () => {
  describe('(incoming)', () => {
    it('should fail on params', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        done()
      }
      RandomizeTransactions.incoming({
        memes: 'HARAMBE',
      }, callback)
    })
    it('should generate the random transactions', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.transactions.ASDASDASDASD).toBeA('number')
        expect(data.transactions.QWEQWEQWEQE).toBeA('number')
        expect(data.transactions.ZXCZXCZXXZC).toBeA('number')
        done()
      }
      RandomizeTransactions.incoming({
        totalToSend: 100,
        addresses: ['ASDASDASDASD', 'QWEQWEQWEQE', 'ZXCZXCZXXZC'],
      }, callback)
    })
  })
  describe('(outgoing)', () => {
    it('should fail on params', (done) => {
      const callback = (success) => {
        expect(success).toBe(false)
        done()
      }
      RandomizeTransactions.outgoing({
        memes: 'HARAMBE',
      }, callback)
    })
    it('should generate the random transactions', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.partialTransactions[0]).toBeA('number')
        done()
      }
      RandomizeTransactions.outgoing({
        transaction: { address: 'ASDASDASDASD' },
        address: 'ASDASDASDASD',
        amount: 100,
      }, callback)
    })
  })
  describe('(getRandomAccountAddresses)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      RandomizeTransactions.getRandomAccountAddresses({
        memes: 'HARAMBE',
      }, callback)
    })
    it('should fail to get the account addresses', (done) => {
      const accountName = 'testAccount'
      const numAddresses = 5
      const mockClient = {
        getAddressesByAccount: () => { return Promise.reject({ code: -17 }) },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      RandomizeTransactions.getRandomAccountAddresses({ accountName, numAddresses, client: mockClient }, callback)
    })
    it('should get the account addresses', (done) => {
      const accountName = 'testAccount'
      const numAddresses = 2
      const addresses = ['111111', '222222', '333333', '444444']
      const mockClient = {
        getAddressesByAccount: () => { return Promise.resolve(addresses) },
      }
      RandomizeTransactions.chooseRandomAddresses = (options) => {
        expect(options.addresses).toBe(addresses)
        done()
      }
      RandomizeTransactions.getRandomAccountAddresses({ accountName, numAddresses, client: mockClient }, () => {})
    })
  })
  describe('(chooseRandomAddresses)', () => {
    before(() => { // reset the rewired functions
      RandomizeTransactions = rewire('../src/lib/RandomizeTransactions')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      RandomizeTransactions.chooseRandomAddresses({
        memes: 'HARAMBE',
      }, callback)
    })
    it('should pick the right amount of addresses', (done) => {
      const accountName = 'testAccount'
      const numAddresses = 2
      const addresses = ['111111', '222222', '333333', '444444']
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.pickedAddresses.length).toBe(2)
        done()
      }
      RandomizeTransactions.chooseRandomAddresses({ accountName, numAddresses, addresses }, callback)
    })
  })
})
