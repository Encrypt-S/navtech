let fs = require('fs')  // eslint-disable-line
let ursa = require('ursa') // eslint-disable-line
const config = require('config')
const lodash = require('lodash')

const Logger = require('./Logger.js')

let privateSettings = require('../settings/private.settings.json') // eslint-disable-line
let globalSettings = config.get('GLOBAL') // eslint-disable-line

const EncryptedData = {}

EncryptedData.getEncrypted = (options, callback) => {
  const required = ['transaction', 'client']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('ECD_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to EncryptedData.getEncrypted' })
    return
  }

  EncryptedData.runtime = {
    callback,
    transaction: options.transaction,
    client: options.client,
  }

  options.client.getTransaction(options.transaction.txid).then((fullTrans) => {
    const encryptedData = (globalSettings.serverType === 'INCOMING') ? fullTrans['anon-destination'] : fullTrans['tx-comment']
    EncryptedData.decryptData({ encryptedData, transaction: options.transaction }, callback)
  }).catch((err) => {
    Logger.writeLog('ECD_002', 'failed to get transation', { transaction: options.transaction, error: err })
    callback(false, { message: 'failed to get transation' })
    return
  })
}

EncryptedData.decryptData = (options, callback) => {
  const required = ['encryptedData']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('ECD_003', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to EncryptedData.decryptData' })
    return
  }

  EncryptedData.runtime = {
    callback,
    transaction: options.transaction,
    encryptedData: options.encryptedData,
  }

  fs.readdir(privateSettings.keyFolders.private.path, (err, files) => {
    if (err) {
      callback(false, { message: 'failed to read the keyfolder' })
      Logger.writeLog('ECD_010', 'failed to read the keyfolder', { error: err, transaction: options.transasction })
      return
    }
    let successfulDecryption = false
    let decrypted
    for (let i = 0; i < files.length; i++) {
      if (!successfulDecryption) {
        try {
          const keyFile = privateSettings.keyFolders.private.path + files[i]
          const key = ursa.createPrivateKey(fs.readFileSync(keyFile))
          const msg = key.decrypt(options.encryptedData, 'base64', 'utf8', ursa.RSA_PKCS1_PADDING)
          successfulDecryption = true
          decrypted = JSON.parse(msg)
        } catch (err2) {
          // do nothing
        }
      }
    }

    if (!successfulDecryption || !decrypted) {
      Logger.writeLog('ECD_011', 'unable to decrypt', { decrypted, successfulDecryption, transaction: options.transasction })
      callback(false, { message: 'unable to decrypt' })
      return
    }

    callback(true, { decrypted, transaction: options.transaction })
    return
  })
}

module.exports = EncryptedData
