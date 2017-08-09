'use strict'

const config = require('config')
const lodash = require('lodash')

let Logger = require('./Logger.js') //eslint-disable-line
let NavCoin = require('./NavCoin.js') //eslint-disable-line

let globalSettings = config.get('GLOBAL') //eslint-disable-line

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

  SendRawTransaction.runtime = {
    counter: 0,
    retryDelay: 6000,
    spentTransactions: options.spentTransactions,
    outgoingTransactions: options.outgoingTransactions,
    client: options.client,
    encrypted: options.encrypted || false,
    callback,
  } // wipe runtime variables
  SendRawTransaction.create()
}

SendRawTransaction.create = () => {
  if (SendRawTransaction.runtime.encrypted) {
    SendRawTransaction.runtime.client.createRawTransaction(
    SendRawTransaction.runtime.spentTransactions,
    SendRawTransaction.runtime.outgoingTransactions,
    SendRawTransaction.runtime.encrypted).then((rawTrans) => {
      SendRawTransaction.signRaw(rawTrans)
      return
    }).catch((err) => {
      Logger.writeLog('RAW_002', 'unable to create raw transaction', {
        spentTransactions: SendRawTransaction.runtime.spentTransactions,
        outgoingTransactions: SendRawTransaction.runtime.outgoingTransactions,
        encrypted: SendRawTransaction.runtime.encrypted,
        error: err,
      })
      SendRawTransaction.retry(err) // try again
    })
  } else {
    SendRawTransaction.runtime.client.createRawTransaction(
    SendRawTransaction.runtime.spentTransactions,
    SendRawTransaction.runtime.outgoingTransactions).then((rawTrans) => {
      SendRawTransaction.signRaw(rawTrans)
      return
    }).catch((err) => {
      Logger.writeLog('RAW_003', 'unable to create raw transaction', {
        spentTransactions: SendRawTransaction.runtime.spentTransactions,
        outgoingTransactions: SendRawTransaction.runtime.outgoingTransactions,
        error: err,
      })
      SendRawTransaction.retry(err) // try again
    })
  }
}

SendRawTransaction.signRaw = (rawTrans) => {
  SendRawTransaction.runtime.client.signRawTransaction(rawTrans).then((signedRaw) => {
    SendRawTransaction.sendRaw(signedRaw)
    return
  }).catch((err) => {
    if (err.code === -13 && !SendRawTransaction.runtime.triedToUnlock) {
      SendRawTransaction.runtime.rawTrans = rawTrans
      const type = (SendRawTransaction.runtime.client.port === settings.navCoin.port) ? 'navCoin' : 'subChain'
      NavCoin.unlockWallet({ settings, client: SendRawTransaction.runtime.client, type }, SendRawTransaction.walletUnlocked)
      return
    }
    Logger.writeLog('RAW_004', 'unable to sign raw transaction', {
      rawTrans,
      error: err,
    })
    SendRawTransaction.retry(err) // try again
  })
}

SendRawTransaction.walletUnlocked = (success, data) => { //@TODO
  if (!success) {
    Logger.writeLog('RAW_006', 'unable to unlock wallet', { success, data })
    SendRawTransaction.runtime.callback(false, data)
    return
  }
  SendRawTransaction.runtime.triedToUnlock = true
  SendRawTransaction.signRaw(SendRawTransaction.runtime.rawTrans)
}

SendRawTransaction.sendRaw = (signedRaw) => {
  if (globalSettings.preventSend) {
    Logger.writeLog('RAW_TEST_001', 'preventSend triggered', { runtime: SendRawTransaction.runtime })
    SendRawTransaction.runtime.callback(true, { rawOutcome: 'dummy-tx-id' })
    return
  }
  SendRawTransaction.runtime.client.sendRawTransaction(signedRaw.hex).then((rawOutcome) => {
    SendRawTransaction.runtime.callback(true, { rawOutcome })
  }).catch((err) => {
    Logger.writeLog('RAW_005', 'unable to send raw transaction', {
      signedRaw: signedRaw,
      error: err,
    })
    SendRawTransaction.retry(err) // try again
  })
}

SendRawTransaction.retry = (err) => {
  if (SendRawTransaction.runtime.counter >= 10) {
    SendRawTransaction.runtime.callback(false, { error: err })
    return
  } else {
    Logger.writeLog('RAW_007', 'retrying', {
      error: err,
      counter: SendRawTransaction.runtime.counter,
    })
    setTimeout(() => {
      SendRawTransaction.runtime.counter += 1
      SendRawTransaction.create()
    }, SendRawTransaction.runtime.retryDelay) //6 second delay & try again
  }
}

module.exports = SendRawTransaction
