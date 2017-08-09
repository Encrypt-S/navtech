'use strict'

const expect = require('expect')
const rewire = require('rewire')

let EncryptionKeys = rewire('../src/lib/EncryptionKeys')

const privKeyFile = './test/keys/private/1482278400000_private.pem'
const pubKeyFile = './test/keys/public/1482278400000_public.pem'

const fsMock = {
  readFileSync: () => {
  },
  readFile: (keyFile, encoding, cb) => {
    cb(null, 'KEY_CONTENTS')
  },
  exists: (file, cb) => {
    cb(true)
  },
  writeFile: (keyfile, key, cb) => {
    cb(null)
  },
  readdir: (path, cb) => {
    cb(null, ['FILE1', 'FILE2'])
  },
  unlink: (file, cb) => {
    cb(null)
  },
}

const fsMockFail = {
  readFileSync: () => {
  },
  readFile: (keyFile, encoding, cb) => {
    cb(null, 'KEY_CONTENTS')
  },
  exists: (file, cb) => {
    cb(false)
  },
  writeFile: (keyfile, key, cb) => {
    cb('FILE_NOT_WRITTEN')
  },
  readdir: (path, cb) => {
    cb('PATH_NOT_FOUND')
  },
}

const fsExistsNoUnlink = {
  exists: (file, cb) => {
    cb(true)
  },
  unlink: (file, cb) => {
    cb('FILE_NOT_REMOVED')
  },
}

const privateSettingsMock = {
  keyFolders: {
    private: {
      path: './test/keys/private/',
      suffix: '_private.pem',
    },
    public: {
      path: './test/keys/public/',
      suffix: '_public.pem',
    },
  },
  encryptionStrength: {
    INCOMING: 2048,
    OUTGOING: 1024,
  },
  keyPeriod: 604800000,
}

const ursaMockFail = {
  createPrivateKey: () => {
    return {
      decrypt: () => {
        return 'NOT_THE_ADDRESS'
      },
    }
  },
  createPublicKey: () => {
    return {
      encrypt: () => {
        return 'ENCRYPTED_MESSAGE'
      },
    }
  },
}

const ursaMock = {
  createPrivateKey: () => {
    return {
      decrypt: () => {
        return 'NWMZ2atWCbUnVDKgmPHeTbGLmMUXZxZ3J3'
      },
    }
  },
  createPublicKey: () => {
    return {
      encrypt: () => {
        return 'ENCRYPTED_MESSAGE'
      },
    }
  },
}

describe('[EncryptionKeys]', () => {
  describe('(testKeyPair)', () => {
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.testKeyPair({
        junkParam: 'sdfsdfsd',
      }, callback)
    })
    it('should fail the and throw an error', (done) => {
      EncryptionKeys.__set__('fs', {})
      EncryptionKeys.__set__('ursa', {})
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.testKeyPair({ privKeyFile, pubKeyFile }, callback)
    })
    it('should fail the encryption', (done) => {
      EncryptionKeys.__set__('fs', fsMock)
      EncryptionKeys.__set__('ursa', ursaMockFail)
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.testKeyPair({ privKeyFile, pubKeyFile }, callback)
    })
    it('should pass the encryption', (done) => {
      EncryptionKeys.__set__('fs', fsMock)
      EncryptionKeys.__set__('ursa', ursaMock)
      const callback = (success, data) => {
        expect(success).toBe(true)
        done()
      }
      EncryptionKeys.testKeyPair({ privKeyFile, pubKeyFile }, callback)
    })
  })
  describe('(getEncryptionKeys)', () => {
    beforeEach(() => { // reset the rewired functions
      EncryptionKeys = rewire('../src/lib/EncryptionKeys')
    })
    it('should find the keys and return them', (done) => {
      EncryptionKeys.getMidnight = () => '1482278400000'
      EncryptionKeys.__set__('fs', fsMock)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.privKeyFile).toEqual(privKeyFile)
        expect(data.pubKeyFile).toEqual(pubKeyFile)
        done()
      }
      EncryptionKeys.getEncryptionKeys({}, callback)
    })
    it('should fail to find the keys and call the generate function', (done) => {
      EncryptionKeys.__set__('fs', fsMockFail)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      EncryptionKeys.generateKeys = (options, callback) => {
        callback(true, { message: 'called generateKeys' })
      }
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.getEncryptionKeys({}, callback)
    })
  })
  describe('(generateKeys)', () => {
    beforeEach(() => { // reset the rewired functions
      EncryptionKeys = rewire('../src/lib/EncryptionKeys')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.generateKeys({
        junkParam: 'sdfsdfsd',
      }, callback)
    })
    it('should fail writing one of the files', (done) => {
      EncryptionKeys.__set__('fs', fsMockFail)
      EncryptionKeys.__set__({ globalSettings: { serverType: 'INCOMING' } })
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.generateKeys({
        pubKeyFile,
        privKeyFile,
      }, callback)
    })
    it('should write the files and return them', (done) => {
      EncryptionKeys.__set__('fs', fsMock)
      EncryptionKeys.__set__({ globalSettings: { serverType: 'INCOMING' } })
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.privKeyFile).toEqual(privKeyFile)
        expect(data.pubKeyFile).toEqual(pubKeyFile)
        done()
      }
      EncryptionKeys.generateKeys({
        pubKeyFile,
        privKeyFile,
      }, callback)
    })
  })
  describe('(findKeysToRemove)', () => {
    beforeEach(() => { // reset the rewired functions
      EncryptionKeys = rewire('../src/lib/EncryptionKeys')
    })
    it('should fail on params', (done) => {
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.findKeysToRemove({
        junkParam: 'sdfsdfsd',
      }, callback)
    })
    it('should fail to find the directory', (done) => {
      EncryptionKeys.__set__('fs', fsMockFail)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      const callback = (success, data) => {
        expect(success).toBe(false)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.findKeysToRemove({
        type: 'private',
      }, callback)
    })
    it('should not find any to remove', (done) => {
      const today = EncryptionKeys.getMidnight(new Date())
      const fsAllNewer = {
        readdir: (path, cb) => {
          cb(null, [today + '_FILE1', today + '_FILE2'])
        },
      }
      EncryptionKeys.__set__('fs', fsAllNewer)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      const callback = (success, data) => {
        expect(success).toBe(true)
        expect(data.message).toBeA('string')
        done()
      }
      EncryptionKeys.findKeysToRemove({
        type: 'private',
      }, callback)
    })
    it('should find one key to remove', (done) => {
      const today = EncryptionKeys.getMidnight(new Date())
      const lastWeek = today - (1000 * 60 * 60 * 24 * 8)
      const fsOneOlder = {
        readdir: (path, cb) => {
          cb(null, [lastWeek + '_FILE1', today + '_FILE2'])
        },
      }
      EncryptionKeys.removeKeys = (options) => {
        expect(options.forRemoval.length).toBe(1)
        done()
      }
      EncryptionKeys.__set__('fs', fsOneOlder)
      EncryptionKeys.findKeysToRemove({
        type: 'private',
      }, () => {})
    })
  })
  describe('(removeKeys)', () => {
    beforeEach(() => { // reset the rewired functions
      EncryptionKeys = rewire('../src/lib/EncryptionKeys')
    })
    it('should remove the private key and search for public keys', (done) => {
      const today = EncryptionKeys.getMidnight(new Date())
      const lastWeek = today - (1000 * 60 * 60 * 24 * 8)
      const forRemoval = [lastWeek + '_FILE1']
      EncryptionKeys.__set__('fs', fsMock)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      EncryptionKeys.findKeysToRemove = (options) => {
        expect(options.type).toBe('public')
        done()
      }
      EncryptionKeys.removeKeys({
        forRemoval,
        type: 'private',
      }, () => {})
    })
    it('should fail to find the private key and search for public keys', (done) => {
      const today = EncryptionKeys.getMidnight(new Date())
      const lastWeek = today - (1000 * 60 * 60 * 24 * 8)
      const forRemoval = [lastWeek + '_FILE1']
      EncryptionKeys.__set__('fs', fsMockFail)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      EncryptionKeys.findKeysToRemove = (options) => {
        expect(options.type).toBe('public')
        done()
      }
      EncryptionKeys.removeKeys({
        forRemoval,
        type: 'private',
      }, () => {})
    })
    it('should find but fail to remove the private key and search for public keys', (done) => {
      const today = EncryptionKeys.getMidnight(new Date())
      const lastWeek = today - (1000 * 60 * 60 * 24 * 8)
      const forRemoval = [lastWeek + '_FILE1']
      EncryptionKeys.__set__('fs', fsExistsNoUnlink)
      EncryptionKeys.__set__({ privateSettings: privateSettingsMock })
      EncryptionKeys.findKeysToRemove = (options) => {
        expect(options.type).toBe('public')
        done()
      }
      EncryptionKeys.removeKeys({
        forRemoval,
        type: 'private',
      }, () => {})
    })
  })
})
