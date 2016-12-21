'use strict'

const Client = require('bitcoin-core')
const config = require('config')

const EncryptionKeys = require('./lib/EncryptionKeys.js')
const Logger = require('./lib/Logger.js')
const PreFlight = require('./lib/PreFlight.js')
const RefillOutgoing = require('./lib/RefillOutgoing.js')
const SelectOutgoing = require('./lib/SelectOutgoing.js')
const ReturnAllToSenders = require('./lib/ReturnAllToSenders.js')
const PrepareIncoming = require('./lib/PrepareIncoming.js')
const RetrieveSubchainAddresses = require('./lib/RetrieveSubchainAddresses.js')
const ProcessIncoming = require('./lib/ProcessIncoming.js')
const SpendToHolding = require('./lib/SpendToHolding.js')

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
  setInterval(() => {
    if (IncomingServer.paused === false) {
      EncryptionKeys.findKeysToRemove({ type: 'private' }, IncomingServer.startProcessing)
    } else {
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
  }, IncomingServer.currentBatchPrepared)
}

IncomingServer.allPendingReturned = (success, data) => {
  console.log('STATUS: IncomingServer.allPendingReturned', success, data)
  if (!success) {
    Logger.writeLog('INC_006', 'failed to return all pending to sender', { success, data }, true)
    IncomingServer.processing = false
    return
  }
  Logger.writeLog('INC_007', 'returned all pending to sender', { success, data }, true)
  IncomingServer.processing = false
  return
}

IncomingServer.currentBatchPrepared = (success, data) => {
  if (!success || !data || !data.currentBatch) {
    IncomingServer.processing = false
    return
  }
  IncomingServer.runtime.currentBatch = data.currentBatch
  RetrieveSubchainAddresses.run({
    subClient: IncomingServer.subClient,
    chosenOutgoing: IncomingServer.runtime.chosenOutgoing,
    currentBatch: data.currentBatch,
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
  ProcessIncoming.run({
    currentBatch: IncomingServer.runtime.currentBatch,
    outgoingPubKey: IncomingServer.runtime.outgoingPubKey,
    subClient: IncomingServer.subClient,
    navClient: IncomingServer.navClient,
    subAddresses: data.subAddresses,
    settings,
  }, IncomingServer.transactionsProcessed)
}

IncomingServer.transactionsProcessed = (success, data) => {
  if (!success || !data) {
    Logger.writeLog('INC_010', 'failed to process transactions', { success, data }, true)
    ReturnAllToSenders.run({
      navClient: IncomingServer.navClient,
    }, IncomingServer.allPendingReturned)
    return
  }

  IncomingServer.runtime.successfulSubTransactions = data.successfulSubTransactions
  IncomingServer.runtime.transactionsToReturn = data.transactionsToReturn

  if (IncomingServer.runtime.transactionsToReturn && IncomingServer.runtime.transactionsToReturn.length > 0) {
    Logger.writeLog('INC_011', 'failed to process some transactions', { success, data }, true)
    ReturnAllToSenders.fromList({
      navClient: IncomingServer.navClient,
      transactionsToReturn: data.transactionsToReturn,
    }, IncomingServer.failedTransactionsReturned)
    return
  }
  IncomingServer.failedTransactionsReturned(true)
}

IncomingServer.failedTransactionsReturned = (success, data) => {
  if (!success) {
    Logger.writeLog('INC_012', 'failed to return failed transactions to sender', { success, data }, true)
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
