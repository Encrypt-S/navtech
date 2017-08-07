const lodash = require('lodash')
const ursa = require('ursa')

let Logger = require('./Logger.js') // eslint-disable-line
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
    remainingTxGroups: options.currentBatch,
    currentFlattened: options.currentFlattened,
    settings: options.settings,
    subClient: options.subClient,
    navClient: options.navClient,
    outgoingPubKey: options.outgoingPubKey,
    subAddresses: options.subAddresses,
    txGroupsToReturn: [],
    successfulTxGroups: [],
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
  if (lodash.size(ProcessIncoming.runtime.remainingTxGroups) < 1) {
    ProcessIncoming.runtime.callback(true, {
      successfulTxGroups: ProcessIncoming.runtime.successfulTxGroups,
      txGroupsToReturn: ProcessIncoming.runtime.txGroupsToReturn,
    })
    return
  }

  const currentTxGroup = ProcessIncoming.runtime.remainingTxGroups[0]

  ProcessIncoming.runtime.remainingFlattened = ProcessIncoming.runtime.currentFlattened[currentTxGroup.unique]
  ProcessIncoming.runtime.destination = currentTxGroup.destination
  ProcessIncoming.runtime.maxDelay = currentTxGroup.timeDelay
  ProcessIncoming.processPartial()
}

ProcessIncoming.processPartial = () => {
  if (ProcessIncoming.runtime.remainingFlattened.length < 1) {
    ProcessIncoming.runtime.successfulTxGroups.push(ProcessIncoming.runtime.remainingTxGroups[0])
    ProcessIncoming.runtime.remainingTxGroups.splice(0, 1)
    ProcessIncoming.processPending()
    return
  }
  ProcessIncoming.reEncryptAddress(
    ProcessIncoming.runtime.destination,
    ProcessIncoming.runtime.maxDelay,
    ProcessIncoming.runtime.remainingTxGroups[0],
    ProcessIncoming.runtime.remainingFlattened[0],
    0
  )
}

ProcessIncoming.partialFailed = (txGroup) => {
  const currentTxGroup = ProcessIncoming.runtime.remainingTxGroups[0]
  if (ProcessIncoming.runtime.currentFlattened[currentTxGroup.unique].length > ProcessIncoming.runtime.remainingFlattened.length) {
    Logger.writeLog('PROI_009', 'partial subchain transaction failure', { txGroup, runtime: ProcessIncoming.runtime })
    ProcessIncoming.runtime.callback(false, { partialFailure: true })
    return
  }
  Logger.writeLog('PROI_009A', 'complete group failure', { txGroup, runtime: ProcessIncoming.runtime })
  ProcessIncoming.runtime.txGroupsToReturn.push(currentTxGroup)
  ProcessIncoming.runtime.remainingTxGroups.splice(0, 1)
  ProcessIncoming.processPending()
}

ProcessIncoming.reEncryptAddress = (destination, maxDelay, txGroup, flattened, counter) => {
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
      // @TODO remove destination from log before deployment
      Logger.writeLog('PROI_005', 'public key encryption failed', { destination, maxDelay, txGroup, flattened, counter, encrypted })
      ProcessIncoming.reEncryptAddress = (destination, maxDelay, txGroup, flattened, counter + 1)
      return
    }

    if (encrypted.length !== privateSettings.encryptionOutput.OUTGOING && counter >= privateSettings.maxEncryptionAttempts) {
      Logger.writeLog('PROI_006', 'max public key encryption failures', { txGroup, counter, encrypted })
      ProcessIncoming.partialFailed(txGroup)
      return
    }

    ProcessIncoming.makeSubchainTx(encrypted, txGroup)
  } catch (err) {
    Logger.writeLog('PROI_007', 'encrypted address invalid', { txGroup, error: err })
    ProcessIncoming.partialFailed(txGroup)
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
