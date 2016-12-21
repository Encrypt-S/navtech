'use strict'

const expect = require('expect')
const rewire = require('rewire')
const config = require('config')

let NavCoin = rewire('../src/lib/NavCoin')
const incomingSettings = config.get('INCOMING')

const fsMock = {
  readdir: (path, encoding, cb) => {
    expect(path).to.equal('/somewhere/on/the/disk')
    cb(null, 'Success!')
  },
}

NavCoin.__set__('fs', fsMock)

describe('[NavCoin]', () => {
  describe('(unlockWallet)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.unlockWallet({}, callback)
    })
    it('should immediately callback if not using a locked wallet', (done) => {
      NavCoin.__set__({ globalSettings: { encryptedWallet: false } })
      const mockClient = {}
      const callback = (success) => {
        expect(success).toBe(true)
        done()
      }
      NavCoin.unlockWallet({ client: mockClient, settings: incomingSettings, type: 'navCoin' }, callback)
    })
    it('should fail to unlock the wallet', (done) => {
      NavCoin.__set__({ globalSettings: { encryptedWallet: true } })
      const mockClient = {
        walletPassphrase: () => { return Promise.reject({ code: -5 }) },
        walletLock: () => { return Promise.resolve() },
      }
      const callback = (success, error) => {
        expect(success).toBe(false)
        expect(error.message).toBeA('string')
        done()
      }
      NavCoin.unlockWallet({ client: mockClient, settings: incomingSettings, type: 'navCoin' }, callback)
    })
    it('should unlock the wallet', (done) => {
      const mockClient = {
        walletPassphrase: () => { return Promise.resolve({ code: -17 }) },
        walletLock: () => { return Promise.resolve({ code: -17 }) },
      }
      const callback = (success) => {
        expect(success).toEqual(true)
        done()
      }
      NavCoin.unlockWallet({ client: mockClient, settings: incomingSettings, type: 'navCoin' }, callback)
    })
  })
  describe('(lockWallet)', () => {
    before(() => { // reset the rewired functions
      NavCoin = rewire('../src/lib/NavCoin')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.lockWallet({}, callback)
    })
    it('should fail to lock the wallet', (done) => {
      const mockClient = {
        walletLock: () => { return Promise.reject({ code: -5 }) },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.lockWallet({ client: mockClient, type: 'navCoin' }, callback)
    })
    it('should lock the wallet', (done) => {
      const mockClient = {
        walletLock: () => { return Promise.resolve({ message: 'WALLET_UNLOCKED' }) },
      }
      NavCoin.unlockWallet = (options, callback) => {
        expect(options.type).toBe('navCoin')
        expect(options.client).toBe(mockClient)
        expect(callback).toBeA('function')
        done()
      }
      NavCoin.lockWallet({ client: mockClient, type: 'navCoin' }, () => {})
    })
  })
  describe('(filterUnspent)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.filterUnspent({}, callback)
    })
    it('should to get the addresses by account', (done) => {
      const unspent = []
      const accountName = 'incomingAccount'
      const mockClient = {
        getAddressesByAccount: () => { return Promise.reject({ code: -17 }) },
      }
      const callback = (success) => {
        expect(success).toBe(false)
        done()
      }
      NavCoin.filterUnspent({ client: mockClient, unspent, accountName }, callback)
    })
    it('should not find any intersecting addresses', (done) => {
      const unspent = [
        { address: '1111', amount: 10 },
        { address: '2222', amount: 20 },
        { address: '2222', amount: 30 },
      ]
      const accountName = 'incomingAccount'
      const mockClient = {
        getAddressesByAccount: () => { return Promise.resolve(['4444', '5555', '6666']) },
      }
      const callback = (success) => {
        expect(success).toBe(false)
        done()
      }
      NavCoin.filterUnspent({ client: mockClient, unspent, accountName }, callback)
    })
    it('should find 1 intersecting address', (done) => {
      const unspent = [
        { address: '1111', amount: 10 },
        { address: '2222', amount: 20 },
        { address: '2222', amount: 30 },
      ]
      const accountName = 'incomingAccount'
      const mockClient = {
        getAddressesByAccount: () => { return Promise.resolve(['1111', '5555', '6666']) },
      }
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.currentPending.length).toBe(1)
        done()
      }
      NavCoin.filterUnspent({ client: mockClient, unspent, accountName }, callback)
    })
    it('should find 3 intersecting address', (done) => {
      const unspent = [
        { address: '1111', amount: 10 },
        { address: '2222', amount: 20 },
        { address: '2222', amount: 30 },
      ]
      const accountName = 'incomingAccount'
      const mockClient = {
        getAddressesByAccount: () => { return Promise.resolve(['1111', '2222', '3333']) },
      }
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.currentPending.length).toBe(3)
        done()
      }
      NavCoin.filterUnspent({ client: mockClient, unspent, accountName }, callback)
    })
  })
  describe('(checkBlockHeight)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.checkBlockHeight({}, callback)
    })
    it('should fail getInfo', (done) => {
      const mockClient = {
        getInfo: () => { return Promise.reject('FAILED_GET_INFO') },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.checkBlockHeight({ client: mockClient, blockThreshold: 1 }, callback)
    })
    it('should pass getInfo and fail getBlockCount', (done) => {
      const mockClient = {
        getInfo: () => { return Promise.resolve({ blocks: 100 }) },
        getBlockCount: () => { return Promise.reject('FAILED_GET_INFO') },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.checkBlockHeight({ client: mockClient, blockThreshold: 1 }, callback)
    })
    it('should fail due to being too far behind', (done) => {
      const mockClient = {
        getInfo: () => { return Promise.resolve({ blocks: 100 }) },
        getBlockCount: () => { return Promise.resolve(110) },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.checkBlockHeight({ client: mockClient, blockThreshold: 1 }, callback)
    })
    it('should pass the block check', (done) => {
      const mockClient = {
        getInfo: () => { return Promise.resolve({ blocks: 100, balance: 10000 }) },
        getBlockCount: () => { return Promise.resolve(100) },
      }
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.balance).toBe(10000)
        done()
      }
      NavCoin.checkBlockHeight({ client: mockClient, blockThreshold: 1 }, callback)
    })
  })
  describe('(validateAddresses)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.validateAddresses({}, callback)
    })
    it('should fail the validateAddress call', (done) => {
      const mockClient = {
        validateAddress: () => { return Promise.reject('FAILED_VALIDATE_ADDRESS') },
      }
      const addresses = ['111111', '222222', '333333']
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.validateAddresses({ client: mockClient, addresses }, callback)
    })
    it('should not validate the addresses', (done) => {
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: false }) },
      }
      const addresses = ['111111', '222222', '333333']
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      NavCoin.validateAddresses({ client: mockClient, addresses }, callback)
    })
    it('should validate the addresses', (done) => {
      const mockClient = {
        validateAddress: () => { return Promise.resolve({ isvalid: true }) },
      }
      const addresses = ['111111', '222222', '333333']
      const callback = (success) => {
        expect(success).toBe(true)
        done()
      }
      NavCoin.validateAddresses({ client: mockClient, addresses }, callback)
    })
  })
})


  // PRUNE INCOMING UNSPENT ----------------------------------------------------------------------------------------------------------------
  //
  // describe('pruneIncomingUnspent', () => {
  //   it('should fail on params', (done) => {
  //     const callback = (success) => {
  //       expect(success).toBe(false)
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({}, callback)
  //   })
  //   it('should not prune any pending', (done) => {
  //     const currentPending = [
  //       { address: '1111', amount: 10 },
  //       { address: '2222', amount: 20 },
  //       { address: '2222', amount: 30 },
  //     ]
  //     const callback = (success, data) => {
  //       expect(success).toBe(true)
  //       expect(data.currentBatch.length).toBe(3)
  //       expect(data.sumPending).toBe(60)
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({ currentPending, subBalance: 1000, maxAmount: 100 }, callback)
  //   })
  //   it('should prune all pending', (done) => {
  //     const currentPending = [
  //       { address: '1111', amount: 100 },
  //       { address: '2222', amount: 200 },
  //       { address: '2222', amount: 300 },
  //     ]
  //     const callback = (success, data) => {
  //       expect(success).toBe(false)
  //       expect(data.error).toBe('no pruned')
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({ currentPending, subBalance: 1000, maxAmount: 50 }, callback)
  //   })
  //   it('should prune to the maxAmount', (done) => {
  //     const currentPending = [
  //       { address: '1111', amount: 100 },
  //       { address: '2222', amount: 20 },
  //       { address: '2222', amount: 30 },
  //     ]
  //     const callback = (success, data) => {
  //       expect(success).toBe(true)
  //       expect(data.currentBatch.length).toBe(2)
  //       expect(data.sumPending).toBe(50)
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({ currentPending, subBalance: 1000, maxAmount: 100 }, callback)
  //   })
  //   it('should prune to the right number subcoins', (done) => {
  //     const currentPending = [
  //       { address: '1111', amount: 100 },
  //       { address: '2222', amount: 20 },
  //       { address: '2222', amount: 30 },
  //     ]
  //     const callback = (success, data) => {
  //       expect(success).toBe(true)
  //       expect(data.currentBatch.length).toBe(1)
  //       expect(data.sumPending).toBe(20)
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({ currentPending, subBalance: 10.01, maxAmount: 100 }, callback)
  //   })
  //   it('should prune to the maximum amount of subaddresses we can receive from the outgoing', (done) => {
  //     const currentPending = []
  //     for (let i = 0; i < 600; i++) {
  //       currentPending.push({ address: i, amount: 10 })
  //     }
  //     const callback = (success, data) => {
  //       expect(success).toBe(true)
  //       expect(data.currentBatch.length).toBe(500)
  //       expect(data.sumPending).toBe(5000)
  //       done()
  //     }
  //     NavCoin.pruneIncomingUnspent({ currentPending, subBalance: 100000, maxAmount: 100000 }, callback)
  //   })
  // })
