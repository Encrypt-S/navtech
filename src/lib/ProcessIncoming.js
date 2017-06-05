const lodash = require('lodash')
const ursa = require('ursa')

let Logger = require('./Logger.js') // eslint-disable-line
let EncryptedData = require('./EncryptedData.js') // eslint-disable-line
let privateSettings = require('../settings/private.settings.json') // eslint-disable-line
let SendToAddress = require('./SendToAddress.js') // eslint-disable-line

const ProcessIncoming = {}

ProcessIncoming.run = (options, callback) => {
  const required = ['currentBatch', 'settings', 'subClient', 'outgoingPubKey', 'subAddresses', 'navClient', 'currentFlattened']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PROI_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ProcessIncoming.run' })
    return
  }
  ProcessIncoming.runtime = {
    callback,
    currentBatch: options.currentBatch,
    currentFlattened: options.currentFlattened,
    settings: options.settings,
    subClient: options.subClient,
    navClient: options.navClient,
    outgoingPubKey: options.outgoingPubKey,
    subAddresses: options.subAddresses,
    transactionsToReturn: [],
    successfulSubTransactions: [],
  }

  ProcessIncoming.runtime.navClient.getBlockCount().then((blockHeight) => {
    ProcessIncoming.runtime.currentBlockHeight = blockHeight
    ProcessIncoming.processPending()
  }).catch((err) => {
    Logger.writeLog('PROI_001A', 'failed to get the current blockheight', { error: err })
    callback(false, { message: 'failed to get the current blockheight' })
    return
  })
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
  if (!success || !data || !data.decrypted || !data.decrypted.n || !data.decrypted.t || !data.transaction) {
    Logger.writeLog('PROI_002', 'failed to decrypt transaction data', { success })
    ProcessIncoming.transactionFailed()
    return
  }
  ProcessIncoming.runtime.navClient.validateAddress(data.decrypted.n).then((addressInfo) => {
    if (addressInfo.isvalid !== true) {
      Logger.writeLog('PROI_003', 'encrypted address invalid', { success, data })
      ProcessIncoming.transactionFailed()
      return
    }
    ProcessIncoming.runtime.remainingFlattened = ProcessIncoming.runtime.currentFlattened[data.transaction.txid]
    ProcessIncoming.runtime.destination = data.decrypted.n
    ProcessIncoming.runtime.maxDelay = data.decrypted.t
    ProcessIncoming.processPartial()
  }).catch((err) => {
    Logger.writeLog('PROI_004', 'failed to decrypt transaction data', { success, error: err })
    ProcessIncoming.transactionFailed()
    return
  })
}

ProcessIncoming.processPartial = () => {
  if (ProcessIncoming.runtime.remainingFlattened.length < 1) {
    ProcessIncoming.runtime.successfulSubTransactions.push(ProcessIncoming.runtime.remainingTransactions[0])
    ProcessIncoming.runtime.remainingTransactions.splice(0, 1)
    ProcessIncoming.processPending()
    return
  }
  ProcessIncoming.reEncryptAddress(
    ProcessIncoming.runtime.destination,
    ProcessIncoming.runtime.maxDelay,
    ProcessIncoming.runtime.remainingTransactions[0],
    ProcessIncoming.runtime.remainingFlattened[0],
    0
  )
}

ProcessIncoming.partialFailed = (transaction) => {
  // @TODO handle this better and make sure its paused upstream
  Logger.writeLog('PROI_009', 'partial subchain transaction failure', { transaction, runtime: ProcessIncoming.runtime })
  ProcessIncoming.runtime.callback(false, { message: 'partial subchain transaction failure' })
  return
}

ProcessIncoming.reEncryptAddress = (destination, maxDelay, transaction, flattened, counter) => {
  try {
    const dataToEncrypt = {
      n: destination, // nav
      v: flattened, // value
      s: ProcessIncoming.runtime.settings.secret, // secret
      t: ProcessIncoming.runtime.currentBlockHeight + Math.round(Math.random() * maxDelay), // time
    }

    // @TODO check all this data actually fits in the 1024bit encryption (i think its okay, 116 characters)
    const encrypted = ProcessIncoming.runtime.outgoingPubKey.encrypt(
      JSON.stringify(dataToEncrypt), 'utf8', 'base64', ursa.RSA_PKCS1_PADDING
    )

    if (encrypted.length !== privateSettings.encryptionOutput.OUTGOING && counter < privateSettings.maxEncryptionAttempts) {
      Logger.writeLog('PROI_005', 'public key encryption failed', { destination, maxDelay, transaction, flattened, counter, encrypted })
      ProcessIncoming.reEncryptAddress = (destination, maxDelay, transaction, flattened, counter + 1)
      return
    }

    if (encrypted.length !== privateSettings.encryptionOutput.OUTGOING && counter >= privateSettings.maxEncryptionAttempts) {
      Logger.writeLog('PROI_006', 'max public key encryption failures', { transaction, counter, encrypted })
      ProcessIncoming.partialFailed(transaction)
      return
    }

    ProcessIncoming.makeSubchainTx(encrypted, transaction)
  } catch (err) {
    Logger.writeLog('PROI_007', 'encrypted address invalid', { transaction, error: err })
    ProcessIncoming.partialFailed(transaction)
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
    ProcessIncoming.partialFailed()
    return
  }
  ProcessIncoming.runtime.subAddresses.splice(0, 1)
  ProcessIncoming.runtime.remainingFlattened.splice(0, 1)
  ProcessIncoming.processPartial()
}

module.exports = ProcessIncoming
