const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let RandomizeTransactions = require('./RandomizeTransactions.js') //eslint-disable-line
let privateSettings = require('../settings/private.settings.json') //eslint-disable-line
let SendRawTransaction = require('./SendRawTransaction.js') //eslint-disable-line

const SpendToHolding = {}

SpendToHolding.run = (options, callback) => {
  const required = ['successfulSubTransactions', 'holdingEncrypted', 'navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('STH_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to SpendToHolding.run' })
    return
  }
  SpendToHolding.runtime = {
    callback,
    successfulSubTransactions: options.successfulSubTransactions,
    holdingEncrypted: options.holdingEncrypted,
    navClient: options.navClient,
  }
  RandomizeTransactions.getRandomAccountAddresses({
    client: SpendToHolding.runtime.navClient,
    accountName: privateSettings.account.HOLDING,
    numAddresses: 1,
  }, SpendToHolding.createHoldingTransactions)
}

SpendToHolding.createHoldingTransactions = (success, data) => {
  if (!success) {
    Logger.writeLog('STH_002', 'could not retrieve holding addresses', { success, data })
    SpendToHolding.runtime.callback(false, { message: 'could not retrieve holding addresses' })
    return
  }

  const satoshiFactor = 100000000
  let sumPendingSatoshi = 0
  for (const successful of SpendToHolding.runtime.successfulSubTransactions) {
    sumPendingSatoshi += Math.round(successful.amount * satoshiFactor) - Math.round(privateSettings.txFee * satoshiFactor)
  }

  const sumPending = sumPendingSatoshi / satoshiFactor

  const spentTransactions = []

  for (let i = 0; i < SpendToHolding.runtime.successfulSubTransactions.length; i++) {
    spentTransactions.push({
      txid: SpendToHolding.runtime.successfulSubTransactions[i].txid,
      vout: parseInt(SpendToHolding.runtime.successfulSubTransactions[i].vout, 10),
    })
  }

  const outgoingTransactions = {}
  outgoingTransactions[data.pickedAddresses[0]] = sumPending

  console.log('STH_TEST_001', outgoingTransactions, spentTransactions, SpendToHolding.runtime.holdingEncrypted)

  SendRawTransaction.createRaw({
    outgoingTransactions,
    spentTransactions,
    client: SpendToHolding.runtime.navClient,
    encrypted: SpendToHolding.runtime.holdingEncrypted,
  }, SpendToHolding.sentToHolding)
}

SpendToHolding.sentToHolding = (success, data) => {
  if (!success) {
    Logger.writeLog('STH_003', 'could not send raw transaction to holding', { success, data })
    SpendToHolding.runtime.callback(false, { message: 'could not send raw transaction to holding' })
    return
  }
  SpendToHolding.runtime.callback(true, data)
}

module.exports = SpendToHolding
