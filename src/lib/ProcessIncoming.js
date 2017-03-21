const lodash = require('lodash')
const ursa = require('ursa')

let Logger = require('./Logger.js')
const EncryptedData = require('./EncryptedData.js')
const privateSettings = require('../settings/private.settings.json')
const SendToAddress = require('./SendToAddress.js')

const ProcessIncoming = {}

ProcessIncoming.run = (options, callback) => {
  const required = ['currentBatch', 'settings', 'subClient', 'outgoingPubKey', 'subAddresses', 'navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PROI_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ProcessIncoming.run' })
    return
  }
  ProcessIncoming.runtime = {
    callback,
    currentBatch: options.currentBatch,
    settings: options.settings,
    subClient: options.subClient,
    navClient: options.navClient,
    outgoingPubKey: options.outgoingPubKey,
    subAddresses: options.subAddresses,
    transactionsToReturn: [],
    successfulSubTransactions: [],
  }
  ProcessIncoming.runtime.remainingTransactions = options.currentBatch
  ProcessIncoming.processPending()
}

ProcessIncoming.processPending = () => {
  if (ProcessIncoming.runtime.remainingTransactions.length < 1) {
    ProcessIncoming.runtime.callback(true, {
      successfulSubTransactions: ProcessIncoming.runtime.successfulSubTransactions,
      transactionsToReturn: ProcessIncoming.runtime.transactionsToReturn,
    })
    return
  }
  EncryptedData.getEncrypted({
    transaction: ProcessIncoming.runtime.remainingTransactions[0],
    client: ProcessIncoming.runtime.navClient,
  }, ProcessIncoming.checkDecrypted)
  return
}

ProcessIncoming.transactionFailed = () => {
  ProcessIncoming.runtime.transactionsToReturn.push(ProcessIncoming.runtime.remainingTransactions[0])
  ProcessIncoming.runtime.remainingTransactions.splice(0, 1)
  ProcessIncoming.processPending()
}

ProcessIncoming.checkDecrypted = (success, data) => {
  if (!success || !data || !data.decrypted || !data.transaction) {
    Logger.writeLog('PROI_002', 'failed to decrypt transaction data', { success })
    ProcessIncoming.transactionFailed()
    return
  }
  ProcessIncoming.runtime.navClient.validateAddress(data.decrypted).then((addressInfo) => {
    if (addressInfo.isvalid !== true) {
      Logger.writeLog('PROI_003', 'encrypted address invalid', { success, data })
      ProcessIncoming.transactionFailed()
      return
    }
    ProcessIncoming.reEncryptAddress(data.decrypted, data.transaction, 0)
  }).catch((err) => {
    Logger.writeLog('PROI_004', 'failed to decrypt transaction data', { success, error: err })
    ProcessIncoming.transactionFailed()
    return
  })
}

ProcessIncoming.reEncryptAddress = (decryptedAddress, transaction, counter) => {
  try {
    const newAmount = transaction.amount - (transaction.amount * ProcessIncoming.runtime.settings.anonFeePercent / 100)
    const dataToEncrypt = {
      a: decryptedAddress,
      n: newAmount,
      s: ProcessIncoming.runtime.settings.secret,
    }

    const encrypted = ProcessIncoming.runtime.outgoingPubKey.encrypt(
      JSON.stringify(dataToEncrypt), 'utf8', 'base64', ursa.RSA_PKCS1_PADDING
    )

    if (encrypted.length !== privateSettings.encryptionOutput.OUTGOING && counter < privateSettings.maxEncryptionAttempts) {
      Logger.writeLog('PROI_005', 'public key encryption failed', { transaction, counter, encrypted })
      ProcessIncoming.reEncryptAddress = (decryptedAddress, transaction, counter + 1)
      return
    }

    if (encrypted.length !== privateSettings.encryptionOutput.OUTGOING && counter >= privateSettings.maxEncryptionAttempts) {
      Logger.writeLog('PROI_006', 'max public key encryption failures', { transaction, counter, encrypted })
      ProcessIncoming.transactionFailed()
      return
    }

    ProcessIncoming.makeSubchainTx(encrypted, transaction)
  } catch (err) {
    Logger.writeLog('PROI_007', 'encrypted address invalid', { transaction, error: err })
    ProcessIncoming.transactionFailed()
    return
  }
}

ProcessIncoming.makeSubchainTx = (encrypted, transaction) => {
  SendToAddress.send({
    client: ProcessIncoming.runtime.subClient,
    address: ProcessIncoming.runtime.subAddresses[0],
    amount: privateSettings.subCoinsPerTx,
    transaction,
    encrypted,
  }, ProcessIncoming.sentSubToOutgoing)
}

ProcessIncoming.sentSubToOutgoing = (success, data) => {
  if (!success || !data || !data.sendOutcome) {
    Logger.writeLog('PROI_008', 'failed subClient send to address', { transaction: data.transaction, error: data.error })
    ProcessIncoming.transactionFailed()
    return
  }
  ProcessIncoming.runtime.successfulSubTransactions.push(data.transaction)
  ProcessIncoming.runtime.subAddresses.splice(0, 1)
  ProcessIncoming.runtime.remainingTransactions.splice(0, 1)
  ProcessIncoming.processPending()
}

module.exports = ProcessIncoming
