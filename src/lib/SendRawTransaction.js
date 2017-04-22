'use strict'

const config = require('config')
const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let NavCoin = require('./NavCoin.js') //eslint-disable-line

const globalSettings = config.get('GLOBAL')

let settings = false
if (globalSettings.serverType === 'INCOMING') settings = config.get('INCOMING')
if (globalSettings.serverType === 'OUTGOING') settings = config.get('OUTGOING')

const SendRawTransaction = {}

SendRawTransaction.createRaw = (options, callback) => {
  const required = ['spentTransactions', 'outgoingTransactions', 'client']
  if (lodash.intersection(Object.keys(options), required).length !== required.length) {
    Logger.writeLog('RAW_001', 'invalid options', { options, required })
    callback(false, { message: 'invalid options provided to SelectOutgoing.run' })
    return
  }

  SendRawTransaction.runtime = {} // wipe the runtime variables
  if (options.encrypted) {
    options.client.createRawTransaction(options.spentTransactions, options.outgoingTransactions, options.encrypted).then((rawTrans) => {
      SendRawTransaction.signRaw({
        client: options.client,
        rawTrans,
      }, callback)
      return
    }).catch((err) => {
      Logger.writeLog('RAW_002', 'unable to create raw transaction', {
        spentTransactions: options.spentTransactions,
        outgoingTransactions: options.outgoingTransactions,
        encrypted: options.encrypted,
        error: err,
      })
      callback(false, { error: err })
    })
  } else {
    options.client.createRawTransaction(options.spentTransactions, options.outgoingTransactions).then((rawTrans) => {
      SendRawTransaction.signRaw({
        client: options.client,
        rawTrans,
      }, callback)
      return
    }).catch((err) => {
      Logger.writeLog('RAW_003', 'unable to create raw transaction', {
        spentTransactions: options.spentTransactions,
        outgoingTransactions: options.outgoingTransactions,
        error: err,
      })
      callback(false, { error: err })
    })
  }
}

SendRawTransaction.signRaw = (options, callback) => {
  options.client.signRawTransaction(options.rawTrans).then((signedRaw) => {
    SendRawTransaction.sendRaw({
      client: options.client,
      signedRaw,
    }, callback)
    return
  }).catch((err) => {
    if (err.code === -13 && !options.triedToUnlock) {
      SendRawTransaction.runtime.options = options
      SendRawTransaction.runtime.callback = callback
      const type = (options.client.port === settings.navCoin.port) ? 'navCoin' : 'subChain'
      NavCoin.unlockWallet({ settings, client: options.client, type }, SendRawTransaction.walletUnlocked)
      return
    }
    Logger.writeLog('RAW_004', 'unable to sign raw transaction', {
      rawTrans: options.rawTrans,
      error: err,
    })
    callback(false, { error: err })
  })
}

SendRawTransaction.walletUnlocked = (success, data) => {
  if (!success) {
    Logger.writeLog('RAW_006', 'unable to unlock wallet', { success, data })
    SendRawTransaction.runtime.callback(false, data)
    return
  }
  const options = {
    client: SendRawTransaction.runtime.options.client,
    rawTrans: SendRawTransaction.runtime.options.rawTrans,
    triedToUnlock: true,
  }
  SendRawTransaction.signRaw(options, SendRawTransaction.runtime.callback)
}

SendRawTransaction.sendRaw = (options, callback) => {
  if (globalSettings.preventSend) {
    Logger.writeLog('RAW_TEST_001', 'preventSend triggered', { options })
    callback(true, { rawOutcome: 'dummy-tx-id' })
    return
  }
  options.client.sendRawTransaction(options.signedRaw.hex).then((rawOutcome) => {
    callback(true, { rawOutcome })
  }).catch((err) => {
    Logger.writeLog('RAW_005', 'unable to send raw transaction', {
      signedRaw: options.signedRaw,
      error: err,
    })
    callback(false, { error: err })
  })
}

module.exports = SendRawTransaction
