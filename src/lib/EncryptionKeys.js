let fs = require('fs')  // eslint-disable-line
let ursa = require('ursa') // eslint-disable-line
const config = require('config')
const lodash = require('lodash')

const Logger = require('./Logger.js')

let privateSettings = require('../settings/private.settings.json') // eslint-disable-line
const globalSettings = config.get('GLOBAL')

const EncryptionKeys = {}

EncryptionKeys.testKeyPair = (options, callback) => {
  const required = ['pubKeyFile', 'privKeyFile']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('ENC_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to EncryptionKeys.testKeyPair' })
    return
  }

  try {
    const address = 'NWMZ2atWCbUnVDKgmPHeTbGLmMUXZxZ3J3'
    const crt = ursa.createPublicKey(fs.readFileSync(options.pubKeyFile))
    const encrypted = crt.encrypt(address, 'utf8', 'base64', ursa.RSA_PKCS1_PADDING)
    const key = ursa.createPrivateKey(fs.readFileSync(options.privKeyFile))
    const decrypted = key.decrypt(encrypted, 'base64', 'utf8', ursa.RSA_PKCS1_PADDING)
    if (decrypted !== address) {
      Logger.writeLog('ENC_002', 'failed to decrypt', { decrypted, address })
      callback(false, { message: 'failed to decrypt' })
      return
    }

    fs.readFile(options.pubKeyFile, 'utf-8', (err, fileData) => {
      if (err) {
        Logger.writeLog('ENC_003', 'failed to get public key contents', { error: err, fileData })
        callback(false, { message: err })
        return
      }
      callback(true, {
        publicKey: fileData,
      })
    })
  } catch (err) {
    Logger.writeLog('ENC_004', 'failed to encrypt', { error: err })
    callback(false, { message: 'failed to encrypt' })
  }
}

EncryptionKeys.getEncryptionKeys = (options, callback) => {
  const date = new Date()
  const today = EncryptionKeys.getMidnight(date)
  const privKeyFile = privateSettings.keyFolders.private.path + today + privateSettings.keyFolders.private.suffix
  const pubKeyFile = privateSettings.keyFolders.public.path + today + privateSettings.keyFolders.public.suffix

  fs.exists(privKeyFile, (privExists) => {
    fs.exists(pubKeyFile, (pubExists) => {
      if (!privExists || !pubExists) {
        EncryptionKeys.generateKeys({ privKeyFile, pubKeyFile }, callback)
      } else {
        callback(true, { privKeyFile, pubKeyFile })
        return
      }
    })
  })
}

EncryptionKeys.generateKeys = (options, callback) => {
  const required = ['pubKeyFile', 'privKeyFile']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('ENC_005', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to EncryptionKeys.generateKeys' })
    return
  }
  const encryptionBits = privateSettings.encryptionStrength[globalSettings.serverType]
  const key = new ursa.generatePrivateKey(encryptionBits, 65537)
  const privkey = key.toPrivatePem().toString('ascii')
  const pubkey = key.toPublicPem().toString('ascii')

  fs.writeFile(options.privKeyFile, privkey, (err1) => {
    if (err1) {
      Logger.writeLog('ENC_005', 'unable to write private key to file system', { privKeyFile: options.privKeyFile, error: err1 })
      callback(false, { message: 'unable to write private key to file system' })
      return
    }
    fs.writeFile(options.pubKeyFile, pubkey, (err2) => {
      if (err2) {
        Logger.writeLog('ENC_007', 'unable to write public key to file system', { pubKeyFile: options.pubKeyFile, error: err2 })
        callback(false)
        return
      }
      callback(true, {
        privKeyFile: options.privKeyFile,
        pubKeyFile: options.pubKeyFile,
      })
      return
    })
  })
}

EncryptionKeys.findKeysToRemove = (options, callback) => {
  const required = ['type']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('ENC_008', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to EncryptionKeys.findKeysToRemove' })
    return
  }
  fs.readdir(privateSettings.keyFolders[options.type].path, (err, files) => {
    if (err) {
      Logger.writeLog('ENC_009', 'failed to open the keys directory', { error: err, files })
      callback(false, { message: 'failed to open directory' })
      return
    }
    const date = new Date()
    const today = EncryptionKeys.getMidnight(date)
    const forRemoval = []
    for (let i = 0; i < files.length; i++) {
      const keyDate = new Date(parseInt(files[i].split('_')[0], 10))
      const keyDay = EncryptionKeys.getMidnight(keyDate)
      const difference = today - keyDay
      if (difference > privateSettings.keyPeriod) forRemoval.push(files[i])
    }
    if (forRemoval.length > 0) {
      EncryptionKeys.removeKeys({ forRemoval, type: options.type }, callback)
    } else {
      if (options.type === 'private') {
        EncryptionKeys.findKeysToRemove({ type: 'public' }, callback)
      } else {
        callback(true, { message: 'nothing to remove' })
      }
    }
  })
}

EncryptionKeys.removeKeys = (options, callback) => {
  if (options.forRemoval.length === 0) {
    if (options.type === 'private') {
      EncryptionKeys.findKeysToRemove({ type: 'public' }, callback)
    } else {
      callback(true, { message: 'all keys removed' })
    }
  } else {
    fs.exists(privateSettings.keyFolders[options.type].path + options.forRemoval[0], (exists) => {
      if (exists) {
        fs.unlink(privateSettings.keyFolders[options.type].path + options.forRemoval[0], (err) => {
          if (err) {
            Logger.writeLog('ENC_010', 'failed to remove the key', { error: err, key: options.forRemoval })
          }
          EncryptionKeys.removeKeys({ forRemoval: options.forRemoval.slice(1), type: options.type }, callback)
        })
      } else {
        EncryptionKeys.removeKeys({ forRemoval: options.forRemoval.slice(1), type: options.type }, callback)
      }
    })
  }
}

EncryptionKeys.getMidnight = (date) => {
  return parseInt(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()), 10)
}

module.exports = EncryptionKeys
