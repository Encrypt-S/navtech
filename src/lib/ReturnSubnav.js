const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let ReturnToSender = require('./ReturnToSender.js') //eslint-disable-line

const ReturnSubnav = {}

ReturnSubnav.run = (options, callback) => {
  const required = ['settings', 'subClient', 'transactions']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RSN_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ReturnSubnav.run' })
    return
  }
  ReturnSubnav.runtime = {
    callback,
    settings: options.settings,
    subClient: options.subClient,
    transactions: options.transactions,
  }
  console.log('options', options)

  ReturnSubnav.runtime.remainingTransactions = options.transactions
  ReturnSubnav.sendToIncoming()
}

ReturnSubnav.sendToIncoming = () => {
  console.log('ReturnSubnav.sendToIncoming')
  if (ReturnSubnav.runtime.remainingTransactions.constructor !== Array || ReturnSubnav.runtime.remainingTransactions.length < 1) {
    ReturnSubnav.runtime.callback(true, { message: 'all subnav returned to incoming server' })
    return
  }
  ReturnToSender.send({
    client: ReturnSubnav.runtime.subClient,
    transaction: ReturnSubnav.runtime.remainingTransactions[0].transaction,
  }, ReturnSubnav.sent)
}

ReturnSubnav.sent = (success, data) => {
  console.log('ReturnSubnav.sent')
  if (!success || !data || !data.rawOutcome) {
    Logger.writeLog('RSN_002', 'unable to return subnav to incoming server', {
      remaining: ReturnSubnav.runtime.remainingTransactions, success, data,
    }, true)
    ReturnSubnav.runtime.callback(false, { message: 'failed to return subnav' })
    return
  }
  ReturnSubnav.runtime.remainingTransactions.splice(0, 1)
  ReturnSubnav.sendToIncoming()
  return
}

module.exports = ReturnSubnav
