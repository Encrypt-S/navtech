const lodash = require('lodash')
const config = require('config')

const globalSettings = config.get('GLOBAL')
let privateSettings = require('../settings/private.settings.json') // eslint-disable-line

let Logger = require('./Logger.js') // eslint-disable-line
let NavCoin = require('./NavCoin.js') // eslint-disable-line
let FlattenTransactions = require('./FlattenTransactions.js') // eslint-disable-line
let GroupPartials = require('./GroupPartials.js') // eslint-disable-line

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
    PrepareIncoming.runtime.callback(false, { message: 'failed to list unspent', err })
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
  GroupPartials.run({
    currentPending: data.currentPending,
    client: PrepareIncoming.runtime.navClient,
  }, PrepareIncoming.partialsGrouped)
}

PrepareIncoming.partialsGrouped = (success, data) => {
  if (!success || !data) {
    Logger.writeLog('PREPI_003A', 'GroupPartials failed', { success, data })
    // @TODO handle this return case
    PrepareIncoming.runtime.callback(false, {
      pendingToReturn: data ? data.transactionsToReturn : null,
    })
  }

  console.log('PREPI_TEST_001', 'debug data', { data })

  if (!data.readyToProcess) {
    Logger.writeLog('PREPI_003AA', 'GroupPartials failed to return correct data', { data })
    // @TODO handle this return case
    PrepareIncoming.runtime.callback(false, {
      pendingToReturn: data.transactionsToReturn ? data.transactionsToReturn : null,
    })
    return
  }
  PrepareIncoming.runtime.transactionsToReturn = data.transactionsToReturn ? data.transactionsToReturn : null

  PrepareIncoming.pruneUnspent({
    readyToProcess: data.readyToProcess,
    client: PrepareIncoming.runtime.navClient,
    subBalance: PrepareIncoming.runtime.subBalance,
    maxAmount: PrepareIncoming.runtime.outgoingNavBalance,
  }, PrepareIncoming.unspentPruned)
}

PrepareIncoming.pruneUnspent = (options, callback) => {
  if (!options.readyToProcess ||
      !parseFloat(options.subBalance) ||
      !parseFloat(options.maxAmount)) {
    Logger.writeLog('PREPI_003B', 'pruneIncomingUnspent invalid params', { options })
    callback(false, { message: 'invalid params' })
    return
  }
  const currentBatch = []
  let hasPruned = false
  let sumPending = 0
  lodash.forEach(options.readyToProcess, (txGroup) => {
    if ((currentBatch.length + 1) * (parseFloat(privateSettings.subCoinsPerTx) + parseFloat(privateSettings.subChainTxFee))
        <= options.subBalance &&
        sumPending + txGroup.amount < parseFloat(options.maxAmount)) {
      sumPending += txGroup.amount
      hasPruned = true
      currentBatch.push(txGroup)
    }
  })
  console.log('currentBatch', currentBatch, options)
  if (hasPruned) {
    callback(true, { currentBatch, sumPending })
  } else {
    callback(true, { message: 'no pruned' })
  }
}

PrepareIncoming.unspentPruned = (success, data) => {
  if (!success || !data || !data.currentBatch || data.currentBatch.length < 1) {
    if (!PrepareIncoming.runtime.transactionsToReturn || PrepareIncoming.runtime.transactionsToReturn < 1) {
      Logger.writeLog('PREPI_003D', 'no pruned and none to return', { success, data })
      PrepareIncoming.runtime.callback(false, {
        pendingToReturn: PrepareIncoming.runtime.transactionsToReturn,
      })
      return
    }
    Logger.writeLog('PREPI_003C', 'no pruned but some to return', { success, data })
    PrepareIncoming.runtime.callback(true, {
      pendingToReturn: PrepareIncoming.runtime.transactionsToReturn,
    })
    return
  }
  PrepareIncoming.runtime.remainingToFlatten = data.currentBatch.slice(0)
  PrepareIncoming.runtime.currentBatch = data.currentBatch.slice(0)
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

    // if it fails, move onto the next transaction
    // this will get rejected after the block timeout if it continually fails
    PrepareIncoming.runtime.remainingToFlatten.splice(0, 1)
    FlattenTransactions.incoming({
      amountToFlatten: PrepareIncoming.runtime.remainingToFlatten[0].amount,
    }, PrepareIncoming.flattened)
    return
  }

  if (PrepareIncoming.runtime.numFlattened + data.flattened.length >= privateSettings.maxAddresses) {
    console.log('num > maxAddresses', PrepareIncoming.runtime.currentBatch)
    PrepareIncoming.runtime.callback(true, {
      currentBatch: PrepareIncoming.runtime.currentBatch,
      currentFlattened: PrepareIncoming.runtime.currentFlattened,
      numFlattened: PrepareIncoming.runtime.numFlattened,
      pendingToReturn: PrepareIncoming.runtime.transactionsToReturn,
    })
    return
  }

  PrepareIncoming.runtime.numFlattened += data.flattened.length
  PrepareIncoming.runtime.currentFlattened[PrepareIncoming.runtime.remainingToFlatten[0].unique] = data.flattened
  PrepareIncoming.runtime.remainingToFlatten.splice(0, 1)

  if (PrepareIncoming.runtime.remainingToFlatten.length === 0) {
    console.log('remaining == 0', PrepareIncoming.runtime.currentBatch)
    PrepareIncoming.runtime.callback(true, {
      currentBatch: PrepareIncoming.runtime.currentBatch,
      currentFlattened: PrepareIncoming.runtime.currentFlattened,
      numFlattened: PrepareIncoming.runtime.numFlattened,
      pendingToReturn: PrepareIncoming.runtime.transactionsToReturn,
    })
    return
  }

  FlattenTransactions.incoming({
    amountToFlatten: PrepareIncoming.runtime.remainingToFlatten[0].amount,
  }, PrepareIncoming.flattened)
}

module.exports = PrepareIncoming
