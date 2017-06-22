const lodash = require('lodash')

const privateSettings = require('../settings/private.settings.json')
let Logger = require('./Logger.js') // eslint-disable-line
let NavCoin = require('./NavCoin.js') // eslint-disable-line
let EncryptedData = require('./EncryptedData.js') // eslint-disable-line
let SendRawTransaction = require('./SendRawTransaction.js') // eslint-disable-line
let RandomizeTransactions = require('./RandomizeTransactions.js') // eslint-disable-line

const RefillOutgoing = {}

RefillOutgoing.run = (options, callback) => {
  const required = ['navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RFL_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to RefillOutgoing.checkHoldingAccount' })
    return
  }

  RefillOutgoing.runtime = {
    callback,
    navClient: options.navClient,
  }

  RefillOutgoing.getUnspent()
}

RefillOutgoing.getUnspent = () => {
  RefillOutgoing.runtime.navClient.listUnspent().then((unspent) => {
    if (unspent.length < 1) {
      Logger.writeLog('RFL_002', 'no unspent in holding account', { unspent })
      RefillOutgoing.runtime.callback(true, { message: 'no unspent in holding account' })
      return
    }
    NavCoin.filterUnspent({
      unspent,
      client: RefillOutgoing.runtime.navClient,
      accountName: privateSettings.account.HOLDING,
    },
    RefillOutgoing.holdingFiltered)
  }).catch((err) => {
    Logger.writeLog('RFL_003', 'failed to list unspent', { error: err })
    RefillOutgoing.runtime.callback(false, { message: 'failed to list unspent' })
    return
  })
}

RefillOutgoing.holdingFiltered = (success, data) => {
  if (!success || !data || !data.currentPending || data.currentPending.length < 1) {
    RefillOutgoing.runtime.callback(true, { message: 'no pending to clear from account' })
    return
  }
  RefillOutgoing.runtime.currentHolding = data.currentPending
  RefillOutgoing.processHolding()
}

RefillOutgoing.processHolding = () => {
  if (RefillOutgoing.runtime.currentHolding.length < 1) {
    Logger.writeLog('RFL_005', 'all holding processed', { currentHolding: RefillOutgoing.runtime.currentHolding })
    RefillOutgoing.runtime.callback(true, { message: 'all holding processed' })
    return
  }

  RefillOutgoing.checkIfHoldingIsSpendable()
}

RefillOutgoing.checkIfHoldingIsSpendable = () => {
  if (RefillOutgoing.runtime.currentHolding[0].confirmations > privateSettings.minConfs) {
    EncryptedData.getEncrypted({
      transaction: RefillOutgoing.runtime.currentHolding[0],
      client: RefillOutgoing.runtime.navClient,
    }, RefillOutgoing.holdingDecrypted)
    return
  }
  Logger.writeLog('RFL_006', 'holding account transaction not spendable', { currentHolding: RefillOutgoing.runtime.currentHolding })
  RefillOutgoing.runtime.currentHolding.splice(0, 1)
  RefillOutgoing.processHolding()
  return
}

RefillOutgoing.holdingDecrypted = (success, data) => {
  if (!success || !data || !data.decrypted || !data.transaction) {
    Logger.writeLog('RFL_007', 'failed to decrypt holding transaction data', { success, data })
    RefillOutgoing.runtime.currentHolding.splice(0, 1)
    RefillOutgoing.processHolding()
    return
  }

  RefillOutgoing.runtime.holdingTransaction = data.transaction

  console.log('RFL_TEST_001', data)

  const addresses = data.decrypted.slice(0)

  if (addresses.constructor !== Array) {
    Logger.writeLog('RFL_007A', 'decrypted data not an array of addresses', { currentHolding: RefillOutgoing.runtime.currentHolding })
    RefillOutgoing.runtime.currentHolding.splice(0, 1)
    RefillOutgoing.processHolding()
    return
  }

  // @TODO check if addresses are valid?

  const numTransactions = Math.ceil(
    Math.random() * (addresses.length - (privateSettings.minNavTransactions - 1))
  ) + (privateSettings.minNavTransactions - 1)

  const randAddresses = []
  while (randAddresses.length < numTransactions) {
    const randomIndex = Math.floor(Math.random() * addresses.length)
    randAddresses.push(addresses[randomIndex])
    addresses.splice(randomIndex, 1)
  }

  RandomizeTransactions.incoming({
    totalToSend: data.transaction.amount,
    addresses: randAddresses,
  }, RefillOutgoing.checkRandomTransactions)
}

RefillOutgoing.checkRandomTransactions = (success, data) => {
  if (!success || !data || !data.transactions || data.transactions.length < 1) {
    Logger.writeLog('RFL_008', 'failed to randomize transactions', { success, data })
    RefillOutgoing.runtime.currentHolding.splice(0, 1)
    RefillOutgoing.processHolding()
    return
  }
  RefillOutgoing.sendRawRefillTransaction(data.transactions)
}

RefillOutgoing.sendRawRefillTransaction = (outgoingTransactions) => {
  const spentTransactions = [{
    txid: RefillOutgoing.runtime.holdingTransaction.txid,
    vout: parseInt(RefillOutgoing.runtime.holdingTransaction.vout, 10),
  }]

  SendRawTransaction.createRaw({
    outgoingTransactions,
    spentTransactions,
    client: RefillOutgoing.runtime.navClient,
  }, RefillOutgoing.refillSent)
}

RefillOutgoing.refillSent = (success, data) => {
  if (!success || !data || !data.rawOutcome) {
    Logger.writeLog('RFL_009', 'failed to send raw refill transaction', {
      holdingTxid: RefillOutgoing.runtime.holdingTransaction.txid,
      holdingTransaction: RefillOutgoing.runtime.holdingTransaction,
    }, true)
  }
  RefillOutgoing.runtime.currentHolding.splice(0, 1)
  RefillOutgoing.processHolding()
  return
}

module.exports = RefillOutgoing
