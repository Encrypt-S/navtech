const lodash = require('lodash')

let Logger = require('./Logger.js') // eslint-disable-line
let RandomizeTransactions = require('./RandomizeTransactions.js') // eslint-disable-line
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
  ProcessOutgoing.runtime.partialTransactions = []
  RandomizeTransactions.outgoing({
    transaction: ProcessOutgoing.runtime.remainingTransactions[0],
    amount: ProcessOutgoing.runtime.remainingTransactions[0].decrypted.n,
    address: ProcessOutgoing.runtime.remainingTransactions[0].decrypted.a,
  }, ProcessOutgoing.amountsRandomized)
  return
}

ProcessOutgoing.transactionFailed = () => {
  ProcessOutgoing.runtime.failedTransactions.push(ProcessOutgoing.runtime.remainingTransactions[0])
  ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
  ProcessOutgoing.processPending()
}

ProcessOutgoing.amountsRandomized = (success, data) => {
  if (!success || !data) {
    Logger.writeLog('PROO_002', 'failed to randomize transaction', { success, data }, true)
    ProcessOutgoing.transactionFailed()
    return
  }
  ProcessOutgoing.runtime.partialTransactions = data.partialTransactions
  ProcessOutgoing.createNavTransactions()
  // ProcessOutgoing.mockSend()
}

ProcessOutgoing.mockSend = () => {
  Logger.writeLog('PROO_003A', 'mock nav sent', { transaction: ProcessOutgoing.runtime.remainingTransactions[0] })
  ProcessOutgoing.runtime.successfulTransactions.push({
    transaction: ProcessOutgoing.runtime.remainingTransactions[0].transaction,
  })
  ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
  ProcessOutgoing.processPending()
}

ProcessOutgoing.createNavTransactions = () => {
  if (ProcessOutgoing.runtime.partialTransactions.length < 1) {
    Logger.writeLog('PROO_003', 'all partial nav sent', {
      transaction: ProcessOutgoing.runtime.remainingTransactions[0].transaction,
    })
    ProcessOutgoing.runtime.successfulTransactions.push({
      transaction: ProcessOutgoing.runtime.remainingTransactions[0].transaction,
    })
    ProcessOutgoing.runtime.remainingTransactions.splice(0, 1)
    ProcessOutgoing.processPending()
    return
  }

  SendToAddress.send({
    client: ProcessOutgoing.runtime.navClient,
    address: ProcessOutgoing.runtime.remainingTransactions[0].decrypted.a,
    amount: ProcessOutgoing.runtime.partialTransactions[0],
    transaction: ProcessOutgoing.runtime.remainingTransactions[0],
  }, ProcessOutgoing.sentPartialNav)
}

ProcessOutgoing.sentPartialNav = (success, data) => {
  if (!success || !data || !data.sendOutcome) {
    Logger.writeLog('PROO_004', 'failed nav send to address', data, true)
    ProcessOutgoing.runtime.callback(false, {
      message: 'failed sending partial transaction to address',
      failedTransaction: ProcessOutgoing.runtime.remainingTransactions[0],
      remainingPartials: ProcessOutgoing.runtime.partialTransactions,
    })
    return
  }
  ProcessOutgoing.runtime.partialTransactions.splice(0, 1)
  ProcessOutgoing.createNavTransactions()
  return
}

module.exports = ProcessOutgoing
