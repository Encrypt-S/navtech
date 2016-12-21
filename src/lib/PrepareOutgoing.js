const lodash = require('lodash')
const config = require('config')

const globalSettings = config.get('GLOBAL')

const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')
const EncryptedData = require('./EncryptedData.js')
const privateSettings = require('../settings/private.settings.json')

const PrepareOutgoing = {}

PrepareOutgoing.run = (options, callback) => {
  const required = ['navClient', 'subClient', 'navBalance', 'settings']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PREPO_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnAllToSenders.run' })
    return
  }
  PrepareOutgoing.runtime = {
    callback,
    navClient: options.navClient,
    subClient: options.subClient,
    navBalance: options.navBalance,
    settings: options.settings,
    failedSubTransactions: [],
    currentBatch: [],
    sumPending: 0,
  }
  PrepareOutgoing.getUnspent()
}

PrepareOutgoing.getUnspent = () => {
  PrepareOutgoing.runtime.subClient.listUnspent().then((unspent) => {
    if (unspent.length < 1) {
      PrepareOutgoing.runtime.callback(false, { message: 'no unspent transactions found' })
      return
    }
    NavCoin.filterUnspent({
      unspent,
      client: PrepareOutgoing.runtime.subClient,
      accountName: privateSettings.account[globalSettings.serverType],
    },
    PrepareOutgoing.unspentFiltered)
  }).catch((err) => {
    Logger.writeLog('PREPO_002', 'failed to list unspent', err)
    PrepareOutgoing.runtime.callback(false, { message: 'failed to list unspent' })
    return
  })
}

PrepareOutgoing.unspentFiltered = (success, data) => {
  if (!success || !data || !data.currentPending || data.currentPending.length < 1) {
    Logger.writeLog('PREPO_003', 'no current pending to return', data)
    PrepareOutgoing.runtime.callback(false, { message: 'no current pending to return' })
    return
  }
  PrepareOutgoing.runtime.currentPending = data.currentPending
  PrepareOutgoing.processTransaction()
}

PrepareOutgoing.processTransaction = () => {
  if (PrepareOutgoing.runtime.currentPending.length < 1) {
    // no more transactions to process
    PrepareOutgoing.runtime.callback(true, {
      failedSubTransactions: PrepareOutgoing.runtime.failedSubTransactions,
      currentBatch: PrepareOutgoing.runtime.currentBatch,
    })
    return
  }
  EncryptedData.getEncrypted({
    transaction: PrepareOutgoing.runtime.currentPending[0],
    client: PrepareOutgoing.runtime.subClient,
  }, PrepareOutgoing.checkDecrypted)
  return
}

PrepareOutgoing.failedTransaction = () => {
  PrepareOutgoing.runtime.failedSubTransactions.push(PrepareOutgoing.runtime.currentPending[0])
  PrepareOutgoing.runtime.currentPending.splice(0, 1)
  PrepareOutgoing.processTransaction()
}

PrepareOutgoing.checkDecrypted = (success, data) => {
  if (!success || !data || !data.decrypted || !data.transaction) {
    Logger.writeLog('PREPO_004', 'failed to decrypt transaction', { success })
    PrepareOutgoing.failedTransaction()
    return
  }
  if (!data.decrypted.a || !data.decrypted.n || !data.decrypted.s) {
    Logger.writeLog('PREPO_005', 'transaction has invalid params', { success })
    PrepareOutgoing.failedTransaction()
    return
  }
  if (parseFloat(data.decrypted.n) > PrepareOutgoing.runtime.settings.maxAmount) {
    Logger.writeLog('PREPO_006', 'decrypted amount is larger than maxAmount', { success })
    PrepareOutgoing.failedTransaction()
    return
  }
  if (data.decrypted.s !== PrepareOutgoing.runtime.settings.secret) {
    Logger.writeLog('PREPO_007', 'secret mismatch', { success })
    PrepareOutgoing.failedTransaction()
  }
  PrepareOutgoing.testDecrypted(data.decrypted, data.transaction)
}

PrepareOutgoing.testDecrypted = (decrypted, transaction) => {
  PrepareOutgoing.runtime.navClient.validateAddress(decrypted.a).then((addressInfo) => {
    if (addressInfo.isvalid !== true) {
      Logger.writeLog('PREPO_008', 'recipient address is invalid', { transaction })
      PrepareOutgoing.failedTransaction()
      return
    }

    if (PrepareOutgoing.runtime.navBalance > PrepareOutgoing.runtime.sumPending + parseFloat(decrypted.n)) {
      PrepareOutgoing.runtime.sumPending = PrepareOutgoing.runtime.sumPending + parseFloat(decrypted.n)
      PrepareOutgoing.runtime.currentBatch.push({ decrypted, transaction })
      PrepareOutgoing.runtime.currentPending.splice(0, 1)
      PrepareOutgoing.processTransaction()
      return
    }
    // max possible nav to send reached
    PrepareOutgoing.runtime.callback(true, {
      failedSubTransactions: PrepareOutgoing.runtime.failedSubTransactions,
      currentBatch: PrepareOutgoing.runtime.currentBatch,
    })
    return
  }).catch((err) => {
    Logger.writeLog('OUT_013', 'navClient failed validate address', { decrypted, transaction, error: err })
    PrepareOutgoing.failedTransaction()
  })
}

module.exports = PrepareOutgoing
