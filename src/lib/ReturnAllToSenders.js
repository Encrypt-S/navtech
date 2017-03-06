const lodash = require('lodash')
const config = require('config')
const globalSettings = config.get('GLOBAL')

const Logger = require('./Logger.js')
const NavCoin = require('./NavCoin.js')
const privateSettings = require('../settings/private.settings.json')
const ReturnToSender = require('./ReturnToSender.js')

const ReturnAllToSenders = {}

ReturnAllToSenders.run = (options, callback) => {
  const required = ['navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RATS_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnAllToSenders.run' })
    return
  }
  ReturnAllToSenders.runtime = {
    callback,
    navClient: options.navClient,
  }

  ReturnAllToSenders.getUnspent()
}

ReturnAllToSenders.fromList = (options, callback) => {
  const required = ['navClient', 'transactionsToReturn']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RATS_001A', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnAllToSenders.fromList' })
  }
  ReturnAllToSenders.runtime = {
    callback,
    navClient: options.navClient,
    transactionsToReturn: options.transactionsToReturn,
  }

  ReturnAllToSenders.returnToSender()
}

ReturnAllToSenders.getUnspent = () => {
  ReturnAllToSenders.runtime.navClient.listUnspent().then((unspent) => {
    if (unspent.length < 1) {
      ReturnAllToSenders.runtime.callback(false, { message: 'no unspent transactions found' })
      return
    }
    NavCoin.filterUnspent({
      unspent,
      client: ReturnAllToSenders.runtime.navClient,
      accountName: privateSettings.account[globalSettings.serverType],
    },
    ReturnAllToSenders.unspentFiltered)
  }).catch((err) => {
    Logger.writeLog('RATS_002', 'failed to list unspent', err)
    ReturnAllToSenders.runtime.callback(false, { message: 'failed to list unspent' })
    return
  })
}

ReturnAllToSenders.unspentFiltered = (success, data) => {
  if (!success || !data || !data.currentPending || data.currentPending.length < 1) {
    Logger.writeLog('RATS_003', 'failed to filter unspent', data)
    ReturnAllToSenders.runtime.callback(false, { message: 'no current pending to return' })
    return
  }

  ReturnAllToSenders.runtime.transactionsToReturn = data.currentPending
  ReturnAllToSenders.returnToSender()
}

ReturnAllToSenders.returnToSender = () => {
  if (ReturnAllToSenders.runtime.transactionsToReturn.length < 1) {
    ReturnAllToSenders.runtime.callback(true, { message: 'all transactions returned to sender' })
    return
  }
  ReturnToSender.send({
    client: ReturnToSender.runtime.navClient,
    transaction: ReturnAllToSenders.runtime.transactionsToReturn[0] },
  ReturnAllToSenders.returnedToSender)
}

ReturnAllToSenders.returnedToSender = (success, data) => {
  if (!success || !data || !data.rawOutcome) {
    Logger.writeLog('RATS_004', 'unable to return to sender', { success, data })
  }
  ReturnAllToSenders.runtime.transactionsToReturn.splice(0, 1)
  ReturnAllToSenders.returnToSender()
  return
}

module.exports = ReturnAllToSenders
