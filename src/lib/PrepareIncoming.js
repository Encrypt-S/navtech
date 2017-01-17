const lodash = require('lodash')
const config = require('config')

const globalSettings = config.get('GLOBAL')

const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')
const privateSettings = require('../settings/private.settings.json')

const PrepareIncoming = {}

PrepareIncoming.run = (options, callback) => {
  const required = ['navClient', 'outgoingNavBalance', 'subBalance']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PREPI_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to PrepareIncoming.run' })
    return
  }
  PrepareIncoming.runtime = {
    callback,
    navClient: options.navClient,
    outgoingNavBalance: options.outgoingNavBalance,
    subBalance: options.subBalance,
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
  const required = ['currentPending', 'subBalance', 'maxAmount']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PREPI_004', 'invalid options', { options, required })
    callback(false, {
      message: 'invalid options provided to PrepareIncoming.pruneUnspent',
      currentPending: PrepareIncoming.runtime.currentPending,
    })
    return
  }
  const currentBatch = []
  let hasPruned = false
  let sumPending = 0
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
    callback(false, {
      message: 'no tranasctions left after pruning',
      currentPending: PrepareIncoming.runtime.currentPending,
    })
  }
}

PrepareIncoming.unspentPruned = (success, data) => {
  if (!success || !data || !data.currentBatch || data.currentBatch.length < 1) {
    Logger.writeLog('PREPI_005', 'failed to prune unspent', { success, data })
    PrepareIncoming.runtime.callback(false, {
      message: 'failed to prune unspent',
      currentPending: PrepareIncoming.runtime.currentPending,
    })
    return
  }

  PrepareIncoming.runtime.callback(true, { currentBatch: data.currentBatch })
  return
}

module.exports = PrepareIncoming
