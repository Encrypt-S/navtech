'use strict'

const expect = require('expect')
const rewire = require('rewire')

let EncryptedData = rewire('../src/lib/EncryptedData')

const fsMock = {
  readdir: (path, cb) => {
    expect(path).toBe('./test/keys/private/')
    cb(null, ['1482278400000_private.pem'])
  },
  readFileSync: (keyfile) => {
    expect(keyfile).toBe('./test/keys/private/1482278400000_private.pem')
  },
}

const fsMockFail = {
  readdir: (path, cb) => {
    cb('failed to read the keyfolder', 'Failure!')
  },
}

const privateSettingsMock = {
  keyFolders: {
    private: {
      path: './test/keys/private/',
    },
  },
}

const ursaMock = {
  createPrivateKey: () => {
    return {
      decrypt: () => {
        return '{"n": "XYZ", "u": "1234", "p": "1", "o": "3", "t": 20}'
      },
    }
  },
}

describe('[EncryptedData]', () => {
  describe('(getEncrypted)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.getEncrypted({
        junkParam: 'sdfsdfsd',
      }, callback)
    })
    it('should fail to get the transaction', (done) => {
      const transaction = { txid: '1234' }
      const mockClient = {
        getTransaction: () => { return Promise.reject({ code: -17 }) },
      }
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.getEncrypted({ transaction, client: mockClient }, callback)
    })
    it('should get anon destination for the incoming server', (done) => {
      const transaction = { txid: '1234' }
      const mockClient = {
        getTransaction: () => { return Promise.resolve({ 'anon-destination': 'QWERTY' }) },
      }
      EncryptedData.decryptData = (options) => {
        expect(options.encryptedData).toBe('QWERTY')
        done()
      }
      EncryptedData.__set__({ globalSettings: { serverType: 'INCOMING' } })
      EncryptedData.getEncrypted({ transaction, client: mockClient }, () => {})
    })
    it('should get anon destination for the outgoing server', (done) => {
      const transaction = { txid: '1234' }
      const mockClient = {
        getTransaction: () => { return Promise.resolve({ 'tx-comment': 'QWERTY' }) },
      }
      EncryptedData.decryptData = (options) => {
        expect(options.encryptedData).toBe('QWERTY')
        done()
      }
      EncryptedData.__set__({ globalSettings: { serverType: 'OUTGOING' } })
      EncryptedData.getEncrypted({ transaction, client: mockClient }, () => {})
    })
  })
  describe('(decryptData)', () => {
    beforeEach(() => { // reset the rewired functions
      EncryptedData = rewire('../src/lib/EncryptedData')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.decryptData({}, callback)
    })
    it('should fail to decrypt the data', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.decryptData({ encryptedData: '1234' }, callback)
    })
    it('should fail to read the keyfolder', (done) => {
      EncryptedData.__set__({ privateSettings: privateSettingsMock })
      EncryptedData.__set__('fs', fsMockFail)
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.decryptData({ encryptedData: '1234' }, callback)
    })
    it('should fail to decrypt the data', (done) => {
      EncryptedData.__set__({ privateSettings: privateSettingsMock })
      EncryptedData.__set__('fs', fsMock)
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptedData.decryptData({ encryptedData: '1234' }, callback)
    })
    it('should attempt to decrypt the data', (done) => {
      EncryptedData.__set__({ privateSettings: privateSettingsMock })
      EncryptedData.__set__('fs', fsMock)
      EncryptedData.__set__('ursa', ursaMock)
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.decrypted).toEqual({ n: 'XYZ', u: '1234', p: '1', o: '3', t: 20 })
        done()
      }
      EncryptedData.decryptData({ encryptedData: '1234' }, callback)
    })
  })
})
