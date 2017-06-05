const lodash = require('lodash')
const config = require('config')

const globalSettings = config.get('GLOBAL')
const privateSettings = require('../settings/private.settings.json')

let Logger = require('./Logger.js') // eslint-disable-line
let NavCoin = require('./NavCoin.js') // eslint-disable-line
let FlattenTransactions = require('./FlattenTransactions.js') // eslint-disable-line

const PrepareIncoming = {}

PrepareIncoming.run = (options, callback) => {
  const required = ['navClient', 'outgoingNavBalance', 'subBalance', 'settings']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PREPI_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnAllToSenders.run' })
    return
  }
  PrepareIncoming.runtime = {
    callback,
    navClient: options.navClient,
    outgoingNavBalance: options.outgoingNavBalance,
    subBalance: options.subBalance,
    currentFlattened: {},
    currentBatch: [],
    numFlattened: 0,
    settings: options.settings,
  }

  PrepareIncoming.getUnspent()
}

PrepareIncoming.getUnspent = () => {
  PrepareIncoming.runtime.navClient.listUnspent().then((unspent) => {
    if (unspent.length < 1) {
      PrepareIncoming.runtime.callback(false, { message: 'no unspent transactions found' })
      return
    }
    NavCoin.filterUnspent({
      unspent,
      client: PrepareIncoming.runtime.navClient,
      accountName: privateSettings.account[globalSettings.serverType],
    },
    PrepareIncoming.unspentFiltered)
  }).catch((err) => {
    Logger.writeLog('PREPI_002', 'failed to list unspent', err)
    PrepareIncoming.runtime.callback(false, { message: 'failed to list unspent' })
    return
  })
}

PrepareIncoming.unspentFiltered = (success, data) => {
  if (!success || !data || !data.currentPending || data.currentPending.length < 1) {
    Logger.writeLog('PREPI_003', 'failed to filter unspent', data)
    PrepareIncoming.runtime.callback(false, { message: 'no current pending to return' })
    return
  }

  PrepareIncoming.runtime.currentPending = data.currentPending
  PrepareIncoming.pruneUnspent({
    currentPending: PrepareIncoming.runtime.currentPending,
    client: PrepareIncoming.runtime.navClient,
    subBalance: PrepareIncoming.runtime.subBalance,
    maxAmount: PrepareIncoming.runtime.outgoingNavBalance,
  }, PrepareIncoming.unspentPruned)
}

PrepareIncoming.pruneUnspent = (options, callback) => {
  if (!options.currentPending ||
      !parseFloat(options.subBalance) ||
      !parseFloat(options.maxAmount)) {
    Logger.writeLog('NAV_006', 'pruneIncomingUnspent invalid params', { options })
    callback(false, { message: 'invalid params' })
    return
  }
  const currentBatch = []
  let hasPruned = false
  let sumPending = 0
  // @TODO maxAmount may not be totally spendable as we now time delay on the outgoing server
  for (const pending of options.currentPending) {
    if ((currentBatch.length + 1) * (parseFloat(privateSettings.subCoinsPerTx) + parseFloat(privateSettings.subChainTxFee))
        <= options.subBalance &&
        sumPending + pending.amount < parseFloat(options.maxAmount) &&
        currentBatch.length < privateSettings.maxAddresses) {
      sumPending += pending.amount
      hasPruned = true
      currentBatch.push(pending)
    }
  }
  if (hasPruned) {
    callback(true, { currentBatch, sumPending })
  } else {
    callback(false, { message: 'no pruned' })
  }
}

PrepareIncoming.unspentPruned = (success, data) => {
  if (!success || !data || !data.currentBatch || data.currentBatch.length < 1) {
    Logger.writeLog('PREPI_003', 'failed to prune unspent', { success, data })
    PrepareIncoming.runtime.callback(false, { message: 'failed to prune unspent' })
    return
  }
  PrepareIncoming.runtime.remainingToFlatten = data.currentBatch
  PrepareIncoming.runtime.currentBatch = data.currentBatch
  FlattenTransactions.incoming({
    amountToFlatten: PrepareIncoming.runtime.remainingToFlatten[0].amount,
    anonFeePercent: PrepareIncoming.runtime.settings.anonFeePercent,
  }, PrepareIncoming.flattened)
  return
}

PrepareIncoming.flattened = (success, data) => {
  if (!success || !data || !data.flattened) {
    Logger.writeLog('PREPI_004', 'failed to flatten transactions', {
      success,
      data,
      runtime: PrepareIncoming.runtime,
    })
    PrepareIncoming.runtime.callback(false, { message: 'failed to flatten transactions' })
    return
  }

  PrepareIncoming.runtime.numFlattened += data.flattened.length
  PrepareIncoming.runtime.currentFlattened[PrepareIncoming.runtime.remainingToFlatten[0].txid] = data.flattened
  PrepareIncoming.runtime.remainingToFlatten.splice(0, 1)

  if (PrepareIncoming.runtime.remainingToFlatten.length === 0) {
    PrepareIncoming.runtime.callback(true, {
      currentBatch: PrepareIncoming.runtime.currentBatch,
      currentFlattened: PrepareIncoming.runtime.currentFlattened,
      numFlattened: PrepareIncoming.runtime.numFlattened,
    })
    return
  }
  FlattenTransactions.incoming({
    amountToFlatten: PrepareIncoming.runtime.remainingToFlatten[0].amount,
  }, PrepareIncoming.flattened)
}

module.exports = PrepareIncoming
