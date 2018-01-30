const lodash = require('lodash')

let Logger = require('./Logger.js') // eslint-disable-line
let SendToAddress = require('./SendToAddress.js') // eslint-disable-line

const ProcessOutgoing = {}

ProcessOutgoing.run = (options, callback) => {
  const required = ['currentBatch', 'settings', 'navClient']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('PROO_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to ProcessOutgoing.run' })
    return
  }
  ProcessOutgoing.runtime = {
    callback,
    currentBatch: options.currentBatch,
    settings: options.settings,
    navClient: options.navClient,
    successfulTransactions: [],
    failedTransactions: [],
  }
  ProcessOutgoing.runtime.remainingTransactions = options.currentBatch
  ProcessOutgoing.processPending()
}

ProcessOutgoing.processPending = () => {
  if (ProcessOutgoing.runtime.remainingTransactions.length < 1) {
    ProcessOutgoing.runtime.callback(true, {
      successfulTransactions: ProcessOutgoing.runtime.successfulTransactions,
      failedTransactions: ProcessOutgoing.runtime.failedTransactions,
    })
    return
  }

  // ProcessOutgoing.mockSend()

  SendToAddress.send({
    client: ProcessOutgoing.runtime.navClient,
    address: ProcessOutgoing.runtime.remainingTransactions[0].decrypted.n,
    amount: ProcessOutgoing.runtime.remainingTransactions[0].decrypted.v,
    transaction: ProcessOutgoing.runtime.remainingTransactions[0],
  }, ProcessOutgoing.sentNav)
}

ProcessOutgoing.transactionFailed = () => {
  ProcessOutgoing.runtime.failedTransactions.push(ProcessOutgoing.runtime.remainingTransactions[0])
  ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
  ProcessOutgoing.processPending()
}

ProcessOutgoing.mockSend = () => {
  Logger.writeLog('PROO_003A', 'mock nav sent', { transaction: ProcessOutgoing.runtime.remainingTransactions[0] })
  ProcessOutgoing.runtime.successfulTransactions.push({
    transaction: ProcessOutgoing.runtime.remainingTransactions[0].transaction,
  })
  ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
  ProcessOutgoing.processPending()
}

ProcessOutgoing.sentNav = (success, data) => {
  if (!success || !data || !data.sendOutcome) {
    Logger.writeLog('PROO_004', 'failed nav send to address', data, true)
    ProcessOutgoing.runtime.failedTransactions.push(ProcessOutgoing.runtime.remainingTransactions[0])
  } else {
    ProcessOutgoing.runtime.successfulTransactions.push(ProcessOutgoing.runtime.remainingTransactions[0])
  }
  ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
  ProcessOutgoing.processPending()
  return
}

module.exports = ProcessOutgoing
