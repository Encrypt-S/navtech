'use strict'

const Client = require('bitcoin-core')
const config = require('config')
const lodash = require('lodash')

let EncryptionKeys = require('./lib/EncryptionKeys.js') //eslint-disable-line
let Logger = require('./lib/Logger.js') //eslint-disable-line
let PreFlight = require('./lib/PreFlight.js') //eslint-disable-line
let RefillOutgoing = require('./lib/RefillOutgoing.js') //eslint-disable-line
let SelectOutgoing = require('./lib/SelectOutgoing.js') //eslint-disable-line
let ReturnAllToSenders = require('./lib/ReturnAllToSenders.js') //eslint-disable-line
let PrepareIncoming = require('./lib/PrepareIncoming.js') //eslint-disable-line
let RetrieveSubchainAddresses = require('./lib/RetrieveSubchainAddresses.js') //eslint-disable-line
let ProcessIncoming = require('./lib/ProcessIncoming.js') //eslint-disable-line
let SpendToHolding = require('./lib/SpendToHolding.js') //eslint-disable-line

const settings = config.get('INCOMING')

// --------- Client Initialisation ---------------------------------------------

const IncomingServer = {
  processing: false,
  paused: false,
  runtime: {},
}

IncomingServer.init = () => {
  IncomingServer.navClient = new Client({
    username: settings.navCoin.user,
    password: settings.navCoin.pass,
    port: settings.navCoin.port,
    host: settings.navCoin.host,
  })

  IncomingServer.subClient = new Client({
    username: settings.subChain.user,
    password: settings.subChain.pass,
    port: settings.subChain.port,
    host: settings.subChain.host,
  })

  Logger.writeLog('INC_000', 'server starting')
  EncryptionKeys.findKeysToRemove({ type: 'private' }, IncomingServer.startProcessing)
  IncomingServer.cron = setInterval(() => {
    if (IncomingServer.paused === false) {
      EncryptionKeys.findKeysToRemove({ type: 'private' }, IncomingServer.startProcessing)
    } else {
      clearInterval(IncomingServer.cron)
      Logger.writeLog('INC_001', 'processing paused', { paused: IncomingServer.paused })
    }
  }, settings.scriptInterval)
}

IncomingServer.startProcessing = () => {
  if (IncomingServer.processing) {
    Logger.writeLog('INC_002', 'server still processing', { processing: IncomingServer.processing })
    return
  }
  IncomingServer.processing = true
  IncomingServer.runtime = {}
  IncomingServer.runtime.cycleStart = new Date()
  PreFlight.run({
    navClient: IncomingServer.navClient,
    subClient: IncomingServer.subClient,
    settings,
  }, IncomingServer.preFlightComplete)
}

IncomingServer.preFlightComplete = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_003', 'preflight checks failed', { success, data }, true)
    IncomingServer.processing = false
    return
  }
  IncomingServer.runtime.navBalance = data.navBalance
  IncomingServer.runtime.subBalance = data.subBalance
  RefillOutgoing.run({ navClient: IncomingServer.navClient }, IncomingServer.holdingProcessed)
}

IncomingServer.holdingProcessed = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_004', 'failed to process the holding account', { success, data }, true)
    IncomingServer.processing = false
    IncomingServer.paused = true
    return
  }
  SelectOutgoing.run({
    settings,
    navClient: IncomingServer.navClient,
  }, IncomingServer.outgoingSelected)
}

IncomingServer.outgoingSelected = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_005', 'failed to find outgoing server', { success, data }, true)
    IncomingServer.processing = false
    return
  }

  if (data.returnAllToSenders) {
    if (data.pause) {
      IncomingServer.paused = true
    }
    ReturnAllToSenders.run({
      navClient: IncomingServer.navClient,
    }, IncomingServer.allPendingReturned)
    return
  }

  IncomingServer.runtime.chosenOutgoing = data.chosenOutgoing
  IncomingServer.runtime.outgoingNavBalance = data.outgoingNavBalance
  IncomingServer.runtime.holdingEncrypted = data.holdingEncrypted
  IncomingServer.runtime.outgoingPubKey = data.outgoingPubKey

  PrepareIncoming.run({
    navClient: IncomingServer.navClient,
    outgoingNavBalance: data.outgoingNavBalance,
    subBalance: IncomingServer.runtime.subBalance,
    settings,
  }, IncomingServer.currentBatchPrepared)
}

IncomingServer.allPendingReturned = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_006', 'failed to return all pending to sender', { success, data }, true)
    IncomingServer.processing = false
    IncomingServer.paused = true
    return
  }
  Logger.writeLog('INC_007', 'returned all pending to sender', { success, data }, true)
  IncomingServer.processing = false
  return
}

IncomingServer.currentBatchPrepared = (success, data) => {
  if (!success || !data || ((!data.currentBatch || !data.currentFlattened || !data.numFlattened) && !data.pendingToReturn)) {
    Logger.writeLog('INC_011D', 'prepareIncoming returned bad data', { success, data })
    IncomingServer.processing = false
    return
  }

  IncomingServer.runtime.currentBatch = data.currentBatch
  IncomingServer.runtime.currentFlattened = data.currentFlattened
  IncomingServer.runtime.numFlattened = data.numFlattened
  IncomingServer.runtime.pendingToReturn = data.pendingToReturn

  if (IncomingServer.runtime.pendingToReturn && IncomingServer.runtime.pendingToReturn.length > 0) {
    Logger.writeLog('INC_011', 'failed to process some transactions', { success, data }, true)
    ReturnAllToSenders.fromList({
      navClient: IncomingServer.navClient,
      transactionsToReturn: IncomingServer.runtime.pendingToReturn,
    }, IncomingServer.pendingFailedReturned)
    return
  }

  if (!IncomingServer.runtime.currentBatch || lodash.size(IncomingServer.runtime.currentBatch) === 0) {
    Logger.writeLog('INC_011B', 'no currentBatch to process', { currentBatch: IncomingServer.runtime.currentBatch })
    IncomingServer.processing = false
    return
  }
  RetrieveSubchainAddresses.run({
    subClient: IncomingServer.subClient,
    chosenOutgoing: IncomingServer.runtime.chosenOutgoing,
    numAddresses: IncomingServer.runtime.numFlattened,
  }, IncomingServer.retrievedSubchainAddresses)
}

IncomingServer.pendingFailedReturned = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_011A', 'failed to return failed pending to sender', { success, data }, true)
    IncomingServer.paused = true
    ReturnAllToSenders.run({
      navClient: IncomingServer.navClient,
    }, IncomingServer.allPendingReturned)
  }
  if (!IncomingServer.runtime.currentBatch || lodash.size(IncomingServer.runtime.currentBatch) === 0) {
    Logger.writeLog('INC_011C', 'no currentBatch to process', { currentBatch: IncomingServer.runtime.currentBatch })
    IncomingServer.processing = false
    return
  }
  RetrieveSubchainAddresses.run({
    subClient: IncomingServer.subClient,
    chosenOutgoing: IncomingServer.runtime.chosenOutgoing,
    numAddresses: IncomingServer.runtime.numFlattened,
  }, IncomingServer.retrievedSubchainAddresses)
}

IncomingServer.retrievedSubchainAddresses = (success, data) => {
  if (!success || !data || !data.subAddresses) {
    Logger.writeLog('INC_009', 'failed to retrieve subchain addresses', { success, data }, true)
    ReturnAllToSenders.run({
      navClient: IncomingServer.navClient,
    }, IncomingServer.allPendingReturned)
    return
  }
  // @TODO compile the correct transactions to return
  ProcessIncoming.run({
    currentBatch: IncomingServer.runtime.currentBatch,
    currentFlattened: IncomingServer.runtime.currentFlattened,
    outgoingPubKey: IncomingServer.runtime.outgoingPubKey,
    subClient: IncomingServer.subClient,
    navClient: IncomingServer.navClient,
    subAddresses: data.subAddresses,
    settings,
  }, IncomingServer.transactionsProcessed)
}

IncomingServer.transactionsProcessed = (success, data) => {
  if (!success || !data) {
    if (data && data.partialFailure) {
      Logger.writeLog('INC_010A', 'failed part way through processing subchain transactions', { success, data }, true)
      IncomingServer.paused = true
      IncomingServer.processing = false
      return
    }
    Logger.writeLog('INC_010', 'failed to process transactions', { success, data }, true)
    IncomingServer.paused = true
    ReturnAllToSenders.run({
      navClient: IncomingServer.navClient,
    }, IncomingServer.allPendingReturned)
    return
  }

  IncomingServer.runtime.successfulTxGroups = data.successfulTxGroups
  IncomingServer.runtime.txGroupsToReturn = data.txGroupsToReturn
  IncomingServer.runtime.transactionsToReturn = []

  if (IncomingServer.runtime.txGroupsToReturn && IncomingServer.runtime.txGroupsToReturn.length > 0) {
    Logger.writeLog('INC_011', 'failed to process some transactions', { success, data }, true)

    // extract the relevant transactions to return from the txGroupsToReturn
    for (let i = 0; i < IncomingServer.runtime.txGroupsToReturn.length; i++) {
      const txGroup = IncomingServer.runtime.txGroupsToReturn[i]
      for (let j = 0; j < txGroup.transactions.length; j++) {
        IncomingServer.runtime.transactionsToReturn.push(txGroup.transactions[j])
      }
    }

    ReturnAllToSenders.fromList({
      navClient: IncomingServer.navClient,
      transactionsToReturn: IncomingServer.runtime.transactionsToReturn,
    }, IncomingServer.failedTransactionsReturned)
    return
  }
  IncomingServer.failedTransactionsReturned(true)
}

IncomingServer.failedTransactionsReturned = (success, data) => {
  if (!success) {
    IncomingServer.paused = true
    Logger.writeLog('INC_012', 'failed to return failed transactions to sender', { success, data }, true)
  }
  IncomingServer.runtime.successfulSubTransactions = []
  // extract the relevant transactions to return from the txGroupsToReturn
  for (let i = 0; i < IncomingServer.runtime.successfulTxGroups.length; i++) {
    const txGroup = IncomingServer.runtime.successfulTxGroups[i]
    lodash.forEach(txGroup.transactions, (transaction) => {
      IncomingServer.runtime.successfulSubTransactions.push(transaction)
    })
  }

  SpendToHolding.run({
    successfulSubTransactions: IncomingServer.runtime.successfulSubTransactions,
    holdingEncrypted: IncomingServer.runtime.holdingEncrypted,
    navClient: IncomingServer.navClient,
  }, IncomingServer.spentToHolding)
}

IncomingServer.spentToHolding = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_013', 'failed to spend successful to holding', { success, data }, true)
    IncomingServer.paused = true
    IncomingServer.processing = false
  }
  IncomingServer.processing = false
}

module.exports = IncomingServer
